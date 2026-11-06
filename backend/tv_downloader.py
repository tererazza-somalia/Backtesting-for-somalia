"""
TradingView Data Downloader
===========================
Downloads EXACT TradingView OHLC data using the same WebSocket feed
that powers TradingView charts. Data saved as CSV files that the
backtest engine and chart API will automatically use in preference
over Yahoo Finance data.

Install:
    pip install tvdatafeed

Usage:
    python tv_downloader.py --pair EURUSD --tf 1m --bars 10000
    python tv_downloader.py --pair EURUSD --tf 1d --bars 5000
    python tv_downloader.py --all --tf 1d --bars 5000

    # With TradingView login (unlocks more history, esp. for 1m):
    python tv_downloader.py --pair EURUSD --tf 1m --bars 20000 --username YOUR_TV_EMAIL --password YOUR_TV_PASS

Notes:
    - Without login: ~5000 bars max for intraday, more for daily
    - With free TV account: ~10000-20000 bars for 1m
    - With paid TV plan: full history available
    - Saved as: data/{PAIR}_{TF}_tv.csv  (e.g. EURUSD_1m_tv.csv)
    - server.py and backtest_engine.py will auto-prefer these TV files
"""

import os
import sys
import argparse
import pandas as pd

try:
    from tvDatafeed import TvDatafeed, Interval
except ImportError:
    try:
        from tvDatafeed.main import TvDatafeed, Interval
    except ImportError:
        try:
            from tvdatafeed import TvDatafeed, Interval
        except ImportError:
            try:
                from tvdatafeed.main import TvDatafeed, Interval
            except ImportError as e:
                print(f"[!] tvDatafeed import error: {e}")
                sys.exit(1)

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# TradingView forex symbols — exchange "FX_IDC" is the primary
# forex feed on TradingView (matches what you see on their charts)
TV_SYMBOLS = {
    "EURUSD":  ("EURUSD",  "FX_IDC"),
    "GBPUSD":  ("GBPUSD",  "FX_IDC"),
    "USDJPY":  ("USDJPY",  "FX_IDC"),
    "AUDUSD":  ("AUDUSD",  "FX_IDC"),
    "USDCAD":  ("USDCAD",  "FX_IDC"),
    "USDCHF":  ("USDCHF",  "FX_IDC"),
    "NZDUSD":  ("NZDUSD",  "FX_IDC"),
    "EURGBP":  ("EURGBP",  "FX_IDC"),
    "EURJPY":  ("EURJPY",  "FX_IDC"),
    "GBPJPY":  ("GBPJPY",  "FX_IDC"),
    "XAUUSD":  ("XAUUSD",  "TVC"),     # Gold — lives on TVC exchange
}

# Map our timeframe keys → TvDatafeed Interval enum
INTERVAL_MAP = {
    "1m":  Interval.in_1_minute,
    "3m":  Interval.in_3_minute,
    "5m":  Interval.in_5_minute,
    "15m": Interval.in_15_minute,
    "30m": Interval.in_30_minute,
    "45m": Interval.in_45_minute,
    "1h":  Interval.in_1_hour,
    "2h":  Interval.in_2_hour,
    "3h":  Interval.in_3_hour,
    "4h":  Interval.in_4_hour,
    "1d":  Interval.in_daily,
    "1w":  Interval.in_weekly,
    "1mo": Interval.in_monthly,
}


# ─────────────────────────────────────────────────────────────
# CORE DOWNLOADER
# ─────────────────────────────────────────────────────────────

def download_tv_data(
    pair: str,
    tf: str,
    n_bars: int = 5000,
    username: str = None,
    password: str = None,
    exchange: str = None,
    output_dir: str = DATA_DIR,
) -> pd.DataFrame | None:
    """
    Download OHLCV data from TradingView for a single pair + timeframe.

    Args:
        pair:       e.g. "EURUSD"
        tf:         e.g. "1m", "1h", "1d"
        n_bars:     number of bars to request (more = further back in history)
        username:   TradingView account email (optional, unlocks more history)
        password:   TradingView account password
        output_dir: directory to save CSV

    Returns:
        DataFrame if successful, None if failed.
    """
    pair_clean = pair.upper().replace("/", "").replace("_", "")

    symbol_info = TV_SYMBOLS.get(pair_clean)
    default_symbol = pair_clean
    default_exchange = "FX_IDC"
    if symbol_info:
        default_symbol, default_exchange = symbol_info

    symbol = default_symbol
    target_exchange = (exchange or default_exchange).upper()
    interval = INTERVAL_MAP.get(tf.lower())
    if not interval:
        print(f"  [!] Unknown timeframe: {tf}")
        print(f"      Available: {list(INTERVAL_MAP.keys())}")
        return None

    print(f"\n  Connecting to TradingView{'  (logged in)' if username else '  (anonymous)'}...")

    try:
        if username and password:
            tv = TvDatafeed(username=username, password=password)
        else:
            tv = TvDatafeed()  # anonymous — limited bars
    except Exception as e:
        print(f"  [!] Could not connect to TradingView: {e}")
        return None

    print(f"  Fetching {n_bars} bars of {pair_clean} {tf.upper()} from {target_exchange}:{symbol}...")

    try:
        df = tv.get_hist(
            symbol=symbol,
            exchange=target_exchange,
            interval=interval,
            n_bars=n_bars,
        )
    except Exception as e:
        print(f"  [!] TradingView fetch failed: {e}")
        print("      Try adding --username and --password for your TV account.")
        return None

    if df is None or df.empty:
        print("  [!] No data returned. Try logging in or reducing --bars.")
        return None

    # ── Standardise columns ──
    df = df.rename(columns={
        "open":   "Open",
        "high":   "High",
        "low":    "Low",
        "close":  "Close",
        "volume": "Volume",
    })

    # Keep only OHLCV
    keep_cols = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in df.columns]
    df = df[keep_cols]

    # ── Sanitise index & Ensure Pure UTC ──
    df.index = pd.to_datetime(df.index)
    if df.index.tz is not None:
        df.index = df.index.tz_convert("UTC").tz_localize(None)
    else:
        import datetime
        now_local = datetime.datetime.now()
        now_utc = datetime.datetime.utcnow()
        offset_seconds = (now_local - now_utc).total_seconds()
        # If the latest bar timestamp is close to local system clock rather than UTC, shift to pure UTC
        if len(df) > 0 and abs((df.index[-1] - now_local).total_seconds()) < 7200 and abs(offset_seconds) > 60:
            df.index = df.index - pd.Timedelta(seconds=offset_seconds)

    df.index.name = "Date"
    df = df[~df.index.duplicated(keep="first")].sort_index()

    # ── Sanity clamp (should be clean from TV, but just in case) ──
    df["High"] = df[["High", "Open", "Close"]].max(axis=1)
    df["Low"]  = df[["Low",  "Open", "Close"]].min(axis=1)

    # ── Save ──
    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, f"{pair_clean}_{tf.lower()}_tv.csv")
    df.to_csv(out_path)

    print(f"  [✓] {len(df):,} bars  |  {df.index[0]}  →  {df.index[-1]}")
    print(f"  [✓] Saved → {out_path}")

    return df


def download_all_tv(tf: str, n_bars: int, username=None, password=None):
    """Download all pairs for a given timeframe."""
    print("\n" + "=" * 60)
    print(f"  TRADINGVIEW BULK DOWNLOAD  |  TF={tf.upper()}  |  {n_bars} bars/pair")
    print("=" * 60)

    success, failed = 0, 0
    for pair in TV_SYMBOLS:
        df = download_tv_data(pair, tf, n_bars, username, password)
        if df is not None:
            success += 1
        else:
            failed += 1

    print(f"\n  Done: {success} downloaded, {failed} failed.")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download exact TradingView OHLC data.",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("--pair",     type=str, default=None,
                        help="Forex pair (e.g. EURUSD). Omit to use --all.")
    parser.add_argument("--tf",       type=str, default="1d",
                        help="Timeframe: 1m 5m 15m 1h 4h 1d 1w  (default: 1d)")
    parser.add_argument("--bars",     type=int, default=5000,
                        help="Number of bars to download  (default: 5000)")
    parser.add_argument("--all",      action="store_true",
                        help="Download all pairs for the given timeframe.")
    parser.add_argument("--exchange", type=str, default=None,
                        help="Exchange (default: FX_IDC for forex, TVC for gold. e.g. OANDA, FXCM)")
    parser.add_argument("--username", type=str, default=None,
                        help="TradingView email (unlocks more history)")
    parser.add_argument("--password", type=str, default=None,
                        help="TradingView password")
    args = parser.parse_args()

    print()
    print("=" * 60)
    print("  TRADINGVIEW DATA DOWNLOADER")
    print("=" * 60)
    print(f"  Source    : TradingView ({args.exchange or 'FX_IDC'} — same feed as TV charts)")
    print(f"  Timeframe : {args.tf.upper()}")
    print(f"  Bars      : {args.bars:,}")
    print(f"  Login     : {'Yes (' + args.username + ')' if args.username else 'No (anonymous — limited history)'}")
    print("=" * 60)

    if args.all:
        download_all_tv(args.tf, args.bars, args.username, args.password)
    elif args.pair:
        download_tv_data(args.pair, args.tf, args.bars, args.username, args.password, exchange=args.exchange)
    else:
        parser.print_help()
        print("\n  Example:")
        print("    python tv_downloader.py --pair EURUSD --tf 1m --bars 10000")
        print("    python tv_downloader.py --all --tf 1d --bars 5000")
