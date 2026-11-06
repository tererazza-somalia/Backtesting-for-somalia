"""
TradingView Exported CSV Importer
=================================
Imports any CSV exported directly from TradingView charts (using TV's
"Export chart data..." feature) into ilyaas backtesting.

Supports:
  - Any timeframe (1m, 5m, 15m, 1h, 4h, 1d)
  - UNIX timestamps (seconds or milliseconds) or ISO datetime strings
  - Auto-normalises OHLC columns and saves directly to data/{PAIR}_{TF}_tv.csv

Usage:
  python import_tv_csv.py "C:\\path\\to\\FX_IDC_EURUSD, 1.csv" --pair EURUSD --tf 1m
  python import_tv_csv.py "C:\\path\\to\\OANDA_EURUSD, 60.csv" --pair EURUSD --tf 1h
"""

import sys
import os
import argparse
import pandas as pd


def import_tradingview_csv(file_path: str, pair: str = "EURUSD", tf: str = "1m", output_dir: str = "data"):
    if not os.path.exists(file_path):
        print(f"[!] File not found: {file_path}")
        return False

    pair_clean = pair.upper().replace("/", "").replace("_", "")
    tf_clean = tf.lower()

    print("\n" + "=" * 60)
    print(f"  TRADINGVIEW CSV IMPORTER")
    print(f"  Source file: {file_path}")
    print(f"  Target:      {pair_clean} | {tf_clean.upper()}")
    print("=" * 60)

    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        print(f"[!] Failed to read CSV: {e}")
        return False

    # Map column names case-insensitively
    col_map = {}
    time_col = None
    for c in df.columns:
        lc = str(c).strip().lower()
        if lc in ["open", "o"]:
            col_map[c] = "Open"
        elif lc in ["high", "h"]:
            col_map[c] = "High"
        elif lc in ["low", "l"]:
            col_map[c] = "Low"
        elif lc in ["close", "c"]:
            col_map[c] = "Close"
        elif "vol" in lc:
            col_map[c] = "Volume"
        elif lc in ["time", "date", "timestamp", "datetime"]:
            time_col = c

    df = df.rename(columns=col_map)

    required = ["Open", "High", "Low", "Close"]
    missing = [req for req in required if req not in df.columns]
    if missing:
        print(f"[!] Missing required OHLC columns: {missing}")
        print(f"    Found columns: {list(df.columns)}")
        return False

    # Parse timestamps
    if time_col is None:
        time_col = df.columns[0]

    raw_time = df[time_col]
    # Check if raw_time is numeric UNIX epoch
    if pd.api.types.is_numeric_dtype(raw_time) or str(raw_time.iloc[0]).replace(".", "").isdigit():
        sample_val = float(raw_time.iloc[0])
        # If milliseconds (> 1e11)
        unit = "ms" if sample_val > 1e11 else "s"
        df["Date"] = pd.to_datetime(raw_time, unit=unit, utc=True)
    else:
        df["Date"] = pd.to_datetime(raw_time, utc=True)

    # Clean up index
    df = df.set_index("Date").sort_index()
    df = df[~df.index.duplicated(keep="first")]

    if "Volume" not in df.columns:
        df["Volume"] = 0

    df = df[["Open", "High", "Low", "Close", "Volume"]]

    # Ensure numeric
    for col in ["Open", "High", "Low", "Close", "Volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["Open", "High", "Low", "Close"])

    # Sanity clamp
    df["High"] = df[["High", "Open", "Close"]].max(axis=1)
    df["Low"] = df[["Low", "Open", "Close"]].min(axis=1)

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, f"{pair_clean}_{tf_clean}_tv.csv")
    df.to_csv(out_path)

    print(f"\n  [✓] SUCCESS! Imported {len(df):,} exact TradingView candles.")
    print(f"  [✓] Date range : {df.index[0]}  ->  {df.index[-1]}")
    print(f"  [✓] Saved to   : {out_path}")
    print(f"  [✓] Web app & backtest engine will now automatically use this exact TV data!")
    print("=" * 60 + "\n")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import CSV exported from TradingView.")
    parser.add_argument("file", type=str, help="Path to TradingView CSV export")
    parser.add_argument("--pair", type=str, default="EURUSD", help="Forex pair (default: EURUSD)")
    parser.add_argument("--tf", type=str, default="1m", help="Timeframe (e.g. 1m, 5m, 15m, 1h, 4h, 1d)")
    args = parser.parse_args()

    import_tradingview_csv(args.file, pair=args.pair, tf=args.tf)
