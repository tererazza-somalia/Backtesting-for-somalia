"""
Data Verification Script
========================
Cross-checks your local CSV data (Yahoo Finance / OANDA) against
what TradingView would show, and flags any discrepancies.

What it checks:
  1.  File integrity       — file exists, readable, no empty rows
  2.  Date coverage        — gaps, missing days, duplicate timestamps
  3.  OHLC sanity          — High >= Open/Close >= Low, no negative prices
  4.  Candle consistency   — flat candles (open == close == high == low)
  5.  Price spike detector — bars where move > N× ATR (likely bad tick)
  6.  Timezone / offset    — intraday timestamps should be UTC
  7.  Volume anomalies     — zero-volume streaks (common in Yahoo forex)
  8.  TradingView diff     — fetches a small live window from Yahoo Finance
                            and compares close prices to your CSV cache.
                            Shows exact mismatches so you can spot stale
                            or wrong data immediately.

Usage:
  python verify_data.py                          # checks all CSVs in ./data
  python verify_data.py --pair EURUSD --tf 1d   # single pair / timeframe
  python verify_data.py --pair EURUSD --tf 1h --live-compare  # + TV diff
"""

import os
import sys
import argparse
from datetime import datetime, timedelta, timezone

import pandas as pd
import numpy as np

try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False

# ─────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Expected trading days per week for forex (Mon–Fri)
FOREX_DAYS_PER_WEEK = 5

# Spike detector: flag candles whose body/range is > this many × ATR(14)
SPIKE_ATR_MULTIPLIER = 10

# For live-compare: how many recent bars to pull from Yahoo and cross-check
LIVE_COMPARE_BARS = 50

# Yahoo Finance ticker suffix
YF_SUFFIX = {
    "EURUSD": "EURUSD=X", "GBPUSD": "GBPUSD=X", "USDJPY": "USDJPY=X",
    "AUDUSD": "AUDUSD=X", "USDCAD": "USDCAD=X", "USDCHF": "USDCHF=X",
    "NZDUSD": "NZDUSD=X", "EURGBP": "EURGBP=X", "EURJPY": "EURJPY=X",
    "GBPJPY": "GBPJPY=X",
}

YF_INTERVAL_MAP = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "1h",  # 4h not directly available; we use 1h
    "1d": "1d", "1w": "1wk",
}

YF_PERIOD_MAP = {
    "1m": "7d", "5m": "60d", "15m": "60d", "30m": "60d",
    "1h": "730d", "4h": "730d", "1d": "5y", "1w": "5y",
}

COLORS = {
    "ok":    "\033[92m",  # green
    "warn":  "\033[93m",  # yellow
    "error": "\033[91m",  # red
    "info":  "\033[96m",  # cyan
    "bold":  "\033[1m",
    "reset": "\033[0m",
}


def c(color, text):
    return f"{COLORS.get(color, '')}{text}{COLORS['reset']}"


# ─────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────

def infer_pair_tf(filename):
    """Try to parse pair + timeframe from CSV filename like EURUSD_1d_5y.csv"""
    name = os.path.splitext(filename)[0]  # strip .csv
    parts = name.split("_")
    if len(parts) >= 2:
        pair = parts[0].upper()
        tf = parts[1].lower()
        return pair, tf
    return None, None


def load_csv(filepath):
    """Load CSV with robust date parsing."""
    try:
        df = pd.read_csv(filepath, index_col=0, parse_dates=True)
        df.index.name = "Date"
        df = df[~df.index.duplicated(keep="first")].sort_index()
        # Ensure standard column names
        df.columns = [c.strip().capitalize() for c in df.columns]
        # Rename 'Adj close' if present
        if "Adj close" in df.columns:
            df = df.rename(columns={"Adj close": "Adj_close"})
        return df, None
    except Exception as e:
        return None, str(e)


def compute_atr(df, period=14):
    """Compute ATR(14)."""
    h = df["High"]
    l = df["Low"]
    c_ = df["Close"].shift(1)
    tr = pd.concat([h - l, (h - c_).abs(), (l - c_).abs()], axis=1).max(axis=1)
    return tr.rolling(period).mean()


def is_intraday(tf):
    return tf in ("1m", "5m", "15m", "30m", "1h", "4h")


# ─────────────────────────────────────────────────
# CHECK FUNCTIONS — each returns list of issue dicts
# ─────────────────────────────────────────────────

def check_file_integrity(df, filepath):
    issues = []
    if df is None or df.empty:
        issues.append({"level": "error", "msg": "File is empty or could not be loaded."})
        return issues

    required = {"Open", "High", "Low", "Close"}
    missing_cols = required - set(df.columns)
    if missing_cols:
        issues.append({"level": "error", "msg": f"Missing columns: {missing_cols}"})

    null_count = df[list(required - missing_cols)].isnull().sum().sum()
    if null_count > 0:
        issues.append({"level": "warn", "msg": f"{null_count} NaN values in OHLC data."})

    return issues


def check_ohlc_sanity(df):
    issues = []
    if df is None or df.empty:
        return issues

    # High must be >= Open and Close
    bad_high = df[(df["High"] < df["Open"]) | (df["High"] < df["Close"])]
    if len(bad_high) > 0:
        issues.append({"level": "error",
                       "msg": f"{len(bad_high)} bars where High < Open or High < Close.",
                       "rows": bad_high.index[:5].tolist()})

    # Low must be <= Open and Close
    bad_low = df[(df["Low"] > df["Open"]) | (df["Low"] > df["Close"])]
    if len(bad_low) > 0:
        issues.append({"level": "error",
                       "msg": f"{len(bad_low)} bars where Low > Open or Low > Close.",
                       "rows": bad_low.index[:5].tolist()})

    # Negative prices
    neg = df[(df[["Open", "High", "Low", "Close"]] <= 0).any(axis=1)]
    if len(neg) > 0:
        issues.append({"level": "error",
                       "msg": f"{len(neg)} bars with zero or negative prices.",
                       "rows": neg.index[:5].tolist()})

    # Flat candles (O=H=L=C) — common Yahoo Finance artifact
    flat = df[
        (df["Open"] == df["High"]) &
        (df["High"] == df["Low"]) &
        (df["Low"] == df["Close"])
    ]
    if len(flat) > 0:
        issues.append({"level": "warn",
                       "msg": f"{len(flat)} completely flat candles (O=H=L=C). "
                              "Common in Yahoo Finance forex data — TradingView may show different wicks.",
                       "rows": flat.index[:3].tolist()})

    # Note if OHLC errors exist — suggest re-downloading to get clamped data
    if bad_high_count := len(df[(df["High"] < df["Open"]) | (df["High"] < df["Close"])]):
        issues.append({"level": "warn",
                       "msg": f"This CSV was saved before the OHLC sanitiser was added. "
                              f"Re-download the pair to fix {bad_high_count} invalid High bars permanently: "
                              f"venv\\Scripts\\python data_downloader.py"})

    return issues


def check_gaps(df, tf):
    issues = []
    if df is None or len(df) < 2:
        return issues

    idx = df.index

    if is_intraday(tf):
        # Expected delta between bars
        tf_minutes = {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240}
        expected_delta = pd.Timedelta(minutes=tf_minutes.get(tf, 60))

        diffs = idx.to_series().diff().dropna()
        # Gaps larger than 3× the expected interval (skip weekends heuristically)
        big_gaps = diffs[diffs > expected_delta * 3]
        # Filter out weekend gaps (Friday close to Sunday/Monday open ≈ 2 days)
        big_gaps = big_gaps[big_gaps < pd.Timedelta(days=2.5)]

        if len(big_gaps) > 0:
            issues.append({"level": "warn",
                           "msg": f"{len(big_gaps)} intraday gap(s) larger than {expected_delta * 3}.",
                           "rows": big_gaps.index[:5].tolist()})
    else:
        # Daily data — check for missing weekdays (allow weekends/holidays)
        bdays = pd.bdate_range(start=idx[0], end=idx[-1])
        missing = bdays.difference(idx)
        # More than 5 missing business days is suspicious (accounting for holidays)
        if len(missing) > 5:
            issues.append({"level": "warn",
                           "msg": f"{len(missing)} missing business days in date range "
                                  f"({idx[0].date()} → {idx[-1].date()}). "
                                  "Some are holidays; >5 may mean data gaps."})

    # Duplicates
    dups = df[df.index.duplicated(keep=False)]
    if len(dups) > 0:
        issues.append({"level": "error",
                       "msg": f"{len(dups)} duplicate timestamps.",
                       "rows": dups.index[:5].tolist()})

    return issues


def check_spikes(df, tf):
    issues = []
    if df is None or len(df) < 20:
        return issues

    atr = compute_atr(df)
    candle_range = df["High"] - df["Low"]

    # Flag bars where range > N × ATR
    spikes = df[candle_range > (SPIKE_ATR_MULTIPLIER * atr)]
    if len(spikes) > 0:
        details = []
        for ts, row in spikes.iterrows():
            rng = row["High"] - row["Low"]
            mult = rng / atr.loc[ts] if atr.loc[ts] > 0 else 0
            details.append(f"  {ts}  range={rng:.5f}  ({mult:.0f}× ATR)")

        issues.append({"level": "warn",
                       "msg": f"{len(spikes)} possible price spike(s) (range > {SPIKE_ATR_MULTIPLIER}× ATR). "
                              "These often don't appear on TradingView.",
                       "detail": "\n".join(details[:10])})

    return issues


def check_timezone(df, tf):
    issues = []
    if df is None or df.empty or not is_intraday(tf):
        return issues

    first_ts = df.index[0]
    if hasattr(first_ts, "tzinfo") and first_ts.tzinfo is not None:
        if str(first_ts.tzinfo) != "UTC":
            issues.append({"level": "warn",
                           "msg": f"Timestamps are tz-aware but NOT UTC (found: {first_ts.tzinfo}). "
                                  "TradingView expects UTC — your chart bars may appear shifted."})
    else:
        # tz-naive — just note it (server.py handles this via calendar.timegm)
        issues.append({"level": "info",
                       "msg": "Timestamps are tz-naive. Server converts them as UTC — this is correct if "
                              "the source (Yahoo Finance / OANDA) outputs UTC bars."})

    return issues


def check_volume(df):
    issues = []
    if df is None or "Volume" not in df.columns:
        return issues

    zero_vol = (df["Volume"] == 0).sum()
    pct = zero_vol / len(df) * 100
    if pct > 80:
        issues.append({"level": "info",
                       "msg": f"{zero_vol}/{len(df)} bars ({pct:.0f}%) have zero volume. "
                              "Normal for Yahoo Finance forex data (no centralised exchange)."})
    elif pct > 0:
        issues.append({"level": "info",
                       "msg": f"{zero_vol} bars ({pct:.1f}%) have zero volume."})

    return issues


def check_staleness(filepath, tf):
    issues = []
    if not os.path.exists(filepath):
        return issues

    import time as pytime
    age_secs = pytime.time() - os.path.getmtime(filepath)
    age_hours = age_secs / 3600

    thresholds = {
        "1m": 0.5, "5m": 1, "15m": 2, "30m": 4,
        "1h": 12, "4h": 24, "1d": 24, "1w": 168,
    }
    max_age = thresholds.get(tf, 24)

    if age_hours > max_age:
        issues.append({"level": "warn",
                       "msg": f"Cache is {age_hours:.1f}h old (threshold: {max_age}h). "
                              "Re-download to keep in sync with TradingView."})

    return issues


# ─────────────────────────────────────────────────
# LIVE COMPARE: your CSV vs. fresh Yahoo download
# ─────────────────────────────────────────────────

def live_compare(df, pair, tf):
    """
    Download the most recent N bars from Yahoo Finance and diff them
    against the same bars in your local CSV.
    Returns a list of issue dicts.
    """
    issues = []
    if not HAS_YF:
        issues.append({"level": "warn", "msg": "yfinance not installed — skipping live compare."})
        return issues

    ticker = YF_SUFFIX.get(pair.upper())
    if not ticker:
        issues.append({"level": "warn", "msg": f"No Yahoo ticker for {pair} — skipping live compare."})
        return issues

    yf_interval = YF_INTERVAL_MAP.get(tf, "1d")
    yf_period = YF_PERIOD_MAP.get(tf, "5y")

    print(f"    Fetching fresh data from Yahoo Finance ({ticker}, {yf_interval}, {yf_period})...")
    try:
        live = yf.download(ticker, period=yf_period, interval=yf_interval,
                           progress=False, auto_adjust=False)
    except Exception as e:
        issues.append({"level": "error", "msg": f"Yahoo Finance download failed: {e}"})
        return issues

    if live.empty:
        issues.append({"level": "warn", "msg": "Yahoo returned no data for live compare."})
        return issues

    # Flatten multi-level columns
    if isinstance(live.columns, pd.MultiIndex):
        live.columns = [col[0] for col in live.columns]
    live.columns = [c_.strip().capitalize() for c_ in live.columns]
    live.index = pd.to_datetime(live.index).tz_localize(None)  # strip tz for comparison
    live = live[~live.index.duplicated(keep="first")].sort_index()

    # ── Compare only the overlapping bars ──
    local = df.copy()
    local.index = pd.to_datetime(local.index).tz_localize(None)

    # Keep only rows present in BOTH
    common_idx = local.index.intersection(live.index)

    if len(common_idx) == 0:
        issues.append({"level": "warn",
                       "msg": "No overlapping timestamps between local CSV and live Yahoo data. "
                              "Check if the file is from the same source / timeframe."})
        return issues

    # Use last N bars of the overlap
    compare_idx = common_idx[-LIVE_COMPARE_BARS:]

    local_sub = local.loc[compare_idx, ["Open", "High", "Low", "Close"]].astype(float)
    live_sub  = live.loc[compare_idx,  ["Open", "High", "Low", "Close"]].astype(float)

    # Tolerance: 1 pip for non-JPY, 0.01 for JPY
    is_jpy = "JPY" in pair.upper()
    tol = 0.01 if is_jpy else 0.0001  # 1 pip

    mismatches = []
    for col in ["Open", "High", "Low", "Close"]:
        diff = (local_sub[col] - live_sub[col]).abs()
        bad = diff[diff > tol]
        for ts in bad.index:
            mismatches.append({
                "ts":    str(ts)[:19],
                "col":   col,
                "local": round(local_sub.loc[ts, col], 5),
                "live":  round(live_sub.loc[ts, col], 5),
                "diff":  round(diff.loc[ts], 5),
            })

    if mismatches:
        top = mismatches[:20]
        rows = [f"  {m['ts']}  {m['col']:5s}  local={m['local']}  live={m['live']}  Δ={m['diff']}"
                for m in top]
        issues.append({
            "level": "error",
            "msg": (f"{len(mismatches)} mismatch(es) found in {len(compare_idx)} compared bars "
                    f"(tolerance ±{tol})."),
            "detail": "\n".join(rows) + ("\n  ... (truncated)" if len(mismatches) > 20 else ""),
        })
    else:
        issues.append({"level": "ok",
                       "msg": f"All {len(compare_idx)} compared bars match Yahoo Finance within ±{tol} pip. ✓"})

    # ── Coverage check: bars in live not in local ──
    only_in_live = live.index.difference(local.index)
    if len(only_in_live) > 0:
        issues.append({"level": "warn",
                       "msg": f"{len(only_in_live)} bar(s) exist on Yahoo/TradingView but are MISSING from "
                              f"your local CSV. Your cache may be stale.",
                       "rows": only_in_live[-5:].tolist()})

    return issues


# ─────────────────────────────────────────────────
# REPORT PRINTER
# ─────────────────────────────────────────────────

def print_report(label, issues):
    level_order = {"error": 0, "warn": 1, "ok": 2, "info": 3}
    issues_sorted = sorted(issues, key=lambda x: level_order.get(x["level"], 9))

    counts = {"error": 0, "warn": 0, "ok": 0, "info": 0}
    for iss in issues_sorted:
        lv = iss["level"]
        counts[lv] = counts.get(lv, 0) + 1
        icon = {"error": "✗", "warn": "⚠", "ok": "✓", "info": "ℹ"}.get(lv, "?")
        color = {"error": "error", "warn": "warn", "ok": "ok", "info": "info"}.get(lv, "reset")
        print(f"  {c(color, icon)}  {iss['msg']}")
        if "rows" in iss and iss["rows"]:
            for r in iss["rows"][:5]:
                print(f"       → {r}")
        if "detail" in iss and iss["detail"]:
            print(iss["detail"])

    summary_parts = []
    if counts["error"]:
        summary_parts.append(c("error", f"{counts['error']} error(s)"))
    if counts["warn"]:
        summary_parts.append(c("warn", f"{counts['warn']} warning(s)"))
    if counts["ok"] and not counts["error"] and not counts["warn"]:
        summary_parts.append(c("ok", "All checks passed"))
    if not issues:
        summary_parts.append(c("ok", "No issues found ✓"))

    print(f"  Summary: {', '.join(summary_parts) if summary_parts else 'No issues'}")


# ─────────────────────────────────────────────────
# MAIN RUNNER
# ─────────────────────────────────────────────────

def verify_file(filepath, pair, tf, live_compare_enabled=False):
    filename = os.path.basename(filepath)
    print()
    print(c("bold", f"{'─'*60}"))
    print(c("bold", f"  FILE : {filename}"))
    print(c("bold", f"  PAIR : {pair}   TF : {tf}"))
    print(c("bold", f"{'─'*60}"))

    df, load_err = load_csv(filepath)
    if load_err:
        print(c("error", f"  ✗  Could not load file: {load_err}"))
        return

    if df is not None and not df.empty:
        print(f"  Bars loaded : {len(df):,}")
        print(f"  Date range  : {df.index[0]}  →  {df.index[-1]}")
        print(f"  Columns     : {list(df.columns)}")

    all_issues = []
    all_issues += check_file_integrity(df, filepath)
    all_issues += check_ohlc_sanity(df)
    all_issues += check_gaps(df, tf)
    all_issues += check_spikes(df, tf)
    all_issues += check_timezone(df, tf)
    all_issues += check_volume(df)
    all_issues += check_staleness(filepath, tf)

    if live_compare_enabled:
        print(f"\n  {c('info', '[Live Compare]')} Comparing local CSV vs. Yahoo Finance (fresh download)...")
        all_issues += live_compare(df, pair, tf)

    print()
    print_report(filename, all_issues)


def main():
    parser = argparse.ArgumentParser(
        description="Cross-check your backtesting CSV data against TradingView / Yahoo Finance."
    )
    parser.add_argument("--pair", type=str, default=None,
                        help="Forex pair to check (e.g. EURUSD). If omitted, checks all CSVs in ./data.")
    parser.add_argument("--tf", type=str, default=None,
                        help="Timeframe (e.g. 1d, 1h, 5m). If omitted, inferred from filename.")
    parser.add_argument("--live-compare", action="store_true",
                        help="Fetch fresh data from Yahoo Finance and diff against local CSV.")
    parser.add_argument("--data-dir", type=str, default=DATA_DIR,
                        help="Directory containing CSV files (default: ./data).")
    args = parser.parse_args()

    print()
    print(c("bold", "=" * 60))
    print(c("bold", "   BACKTESTING DATA VERIFICATION TOOL"))
    print(c("bold", "=" * 60))
    print(f"   Data directory : {args.data_dir}")
    print(f"   Live compare   : {'YES (Yahoo Finance)' if args.live_compare else 'NO (use --live-compare to enable)'}")
    print(c("bold", "=" * 60))

    # Single file mode
    if args.pair and args.tf:
        pair = args.pair.upper()
        tf = args.tf.lower()
        # Try known file patterns
        candidates = [
            os.path.join(args.data_dir, f"{pair}_{tf}_tv.csv"),
            os.path.join(args.data_dir, f"{pair}_1m_deep.csv"),
            os.path.join(args.data_dir, f"{pair}_{tf}_oanda.csv"),
        ]
        # Also glob for any CSV matching pair+tf
        for fname in os.listdir(args.data_dir):
            if fname.endswith(".csv") and fname.upper().startswith(pair) and f"_{tf}_" in fname.lower():
                candidates.append(os.path.join(args.data_dir, fname))

        found = [p for p in candidates if os.path.exists(p)]
        if not found:
            print(c("error", f"\n  No CSV found for {pair} / {tf} in {args.data_dir}"))
            sys.exit(1)
        for fp in found:
            verify_file(fp, pair, tf, live_compare_enabled=args.live_compare)

    else:
        # Scan all CSVs in data dir
        csvs = [f for f in os.listdir(args.data_dir) if f.endswith(".csv")]
        if not csvs:
            print(c("error", f"\n  No CSV files found in {args.data_dir}"))
            sys.exit(1)

        for fname in sorted(csvs):
            pair, tf = infer_pair_tf(fname)
            if not pair or not tf:
                print(c("warn", f"\n  Skipping {fname} (could not infer pair/timeframe from filename)"))
                continue
            filepath = os.path.join(args.data_dir, fname)
            verify_file(filepath, pair, tf, live_compare_enabled=args.live_compare)

    print()
    print(c("bold", "=" * 60))
    print(c("bold", "   VERIFICATION COMPLETE"))
    print(c("bold", "=" * 60))
    print()


if __name__ == "__main__":
    main()
