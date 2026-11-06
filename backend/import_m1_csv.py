"""
Universal 1-Minute Forex CSV Importer.
Converts any external 1-minute CSV file (from HistData.com, MetaTrader 4/5, or Brokers)
into the standard format for ilyaas backtesting.

Usage:
    python import_m1_csv.py path/to/your_file.csv --pair EURUSD
"""
import sys
import os
import argparse
import pandas as pd


def import_csv(file_path, pair="EURUSD", output_dir="data"):
    if not os.path.exists(file_path):
        print(f"[!] File not found: {file_path}")
        return False

    pair_clean = pair.upper()
    print(f"\nImporting {file_path} for {pair_clean}...")

    # Detect separator (semicolon for HistData, comma for MetaTrader/standard)
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        first_line = f.readline()
        sep = ";" if ";" in first_line else ","

    # Try reading with headers first, then without headers
    try:
        df = pd.read_csv(file_path, sep=sep)
    except Exception as e:
        print(f"[!] Could not read CSV: {e}")
        return False

    # Check if headers exist
    has_ohlc = any("open" in str(c).lower() for c in df.columns)
    if not has_ohlc:
        # Re-read without header (HistData standard)
        # HistData format: Date/Time; Open; High; Low; Close; Volume
        df = pd.read_csv(file_path, sep=sep, header=None)
        if df.shape[1] >= 5:
            df.columns = ["DateTime", "Open", "High", "Low", "Close", "Volume"][:df.shape[1]]
        else:
            print("[!] CSV file does not have enough columns for OHLC data.")
            return False

    # Standardize column names
    col_map = {}
    date_col = None
    for c in df.columns:
        lc = str(c).lower()
        if "open" in lc: col_map[c] = "Open"
        elif "high" in lc: col_map[c] = "High"
        elif "low" in lc: col_map[c] = "Low"
        elif "close" in lc: col_map[c] = "Close"
        elif "vol" in lc: col_map[c] = "Volume"
        elif any(k in lc for k in ["date", "time", "timestamp"]):
            date_col = c

    df = df.rename(columns=col_map)

    if date_col is not None and date_col in df.columns:
        df["Date"] = pd.to_datetime(df[date_col])
        df = df.set_index("Date")
    else:
        # Try using first column as date
        df.iloc[:, 0] = pd.to_datetime(df.iloc[:, 0])
        df = df.set_index(df.columns[0])
        df.index.name = "Date"

    if "Volume" not in df.columns:
        df["Volume"] = 100

    required = ["Open", "High", "Low", "Close"]
    for req in required:
        if req not in df.columns:
            print(f"[!] Missing required column: {req}")
            return False

    df = df[["Open", "High", "Low", "Close", "Volume"]]
    df = df[~df.index.duplicated(keep="first")].sort_index()

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, f"{pair_clean}_1m_deep.csv")
    df.to_csv(out_path)

    print("-" * 60)
    print(f"  [✓] SUCCESS! Imported {len(df):,} one-minute candles.")
    print(f"  [✓] Saved to: {out_path}")
    print(f"  [✓] ilyaas backtesting now has full deep 1m history for {pair_clean}!")
    print("-" * 60 + "\n")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import external 1-minute Forex CSV.")
    parser.add_argument("file", type=str, help="Path to CSV file")
    parser.add_argument("--pair", type=str, default="EURUSD", help="Forex pair (default: EURUSD)")
    args = parser.parse_args()

    import_csv(args.file, pair=args.pair)
