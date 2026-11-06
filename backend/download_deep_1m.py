"""
Deep 1-Minute Historical Forex Data Downloader.
Downloads authentic 1-minute (M1) historical data from Dukascopy Bank's free public archive.

Usage examples:
    python download_deep_1m.py --pair EURUSD --days 30
    python download_deep_1m.py --pair EURUSD --days 90
    python download_deep_1m.py --pair EURUSD --days 365
"""
import sys
import os
import argparse
from datetime import datetime, timedelta
import pandas as pd

try:
    import dukascopy_python
    from dukascopy_python import instruments, TimeUnit, OFFER_SIDE_BID
    HAS_DUKASCOPY = True
except ImportError:
    HAS_DUKASCOPY = False

PAIR_MAP = {
    "EURUSD": "INSTRUMENT_FX_MAJORS_EUR_USD",
    "GBPUSD": "INSTRUMENT_FX_MAJORS_GBP_USD",
    "USDJPY": "INSTRUMENT_FX_MAJORS_USD_JPY",
    "AUDUSD": "INSTRUMENT_FX_MAJORS_AUD_USD",
    "USDCAD": "INSTRUMENT_FX_MAJORS_USD_CAD",
    "USDCHF": "INSTRUMENT_FX_MAJORS_USD_CHF",
    "NZDUSD": "INSTRUMENT_FX_MAJORS_NZD_USD",
    "EURGBP": "INSTRUMENT_FX_CROSSES_EUR_GBP",
    "EURJPY": "INSTRUMENT_FX_CROSSES_EUR_JPY",
    "GBPJPY": "INSTRUMENT_FX_CROSSES_GBP_JPY",
}


def download_dukascopy(pair="EURUSD", days=30, output_dir="data"):
    if not HAS_DUKASCOPY:
        print("\n" + "=" * 60)
        print(" [!] 'dukascopy-python' library is not yet installed.")
        print(" Please run this command to install it:")
        print("     pip install dukascopy-python")
        print("=" * 60 + "\n")
        return False

    pair_clean = pair.upper()
    attr_name = PAIR_MAP.get(pair_clean)
    if not attr_name or not hasattr(instruments, attr_name):
        print(f"[!] Unsupported pair: {pair_clean}")
        print(f"Available pairs: {list(PAIR_MAP.keys())}")
        return False

    instrument_obj = getattr(instruments, attr_name)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    print("\n" + "=" * 60)
    print(f"  DOWNLOADING DEEP 1-MINUTE (M1) DATA FOR {pair_clean}")
    print(f"  Start Date: {start_date.strftime('%Y-%m-%d')}")
    print(f"  End Date:   {end_date.strftime('%Y-%m-%d')} ({days} days)")
    print(f"  Source:     Dukascopy Bank Public Archive (Free)")
    print("=" * 60)
    print("\nFetching data... please wait a moment...\n")

    try:
        df = dukascopy_python.fetch(
            instrument=instrument_obj,
            start=start_date,
            end=end_date,
            interval=1,
            time_unit=TimeUnit.MINUTE,
            offer_side=OFFER_SIDE_BID,
        )

        if df is None or len(df) == 0:
            print("[!] No data returned from Dukascopy for this period.")
            return False

        # Normalize column names to standard: Open, High, Low, Close, Volume
        col_rename = {}
        for c in df.columns:
            lc = str(c).lower()
            if "open" in lc: col_rename[c] = "Open"
            elif "high" in lc: col_rename[c] = "High"
            elif "low" in lc: col_rename[c] = "Low"
            elif "close" in lc: col_rename[c] = "Close"
            elif "vol" in lc: col_rename[c] = "Volume"

        df = df.rename(columns=col_rename)

        for req in ["Open", "High", "Low", "Close"]:
            if req not in df.columns:
                print(f"[!] Column '{req}' not found in downloaded data. Columns: {list(df.columns)}")
                return False

        if "Volume" not in df.columns:
            df["Volume"] = 100

        df.index.name = "Date"
        df = df[~df.index.duplicated(keep="first")].sort_index()

        os.makedirs(output_dir, exist_ok=True)
        out_path = os.path.join(output_dir, f"{pair_clean}_1m_deep.csv")
        df.to_csv(out_path)

        print("-" * 60)
        print(f"  [✓] SUCCESS! Downloaded {len(df):,} one-minute candles.")
        print(f"  [✓] File saved to: {out_path}")
        print(f"  [✓] Now active in your ilyaas backtesting app!")
        print("-" * 60 + "\n")
        return True

    except Exception as e:
        print(f"[!] Error during download: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download deep 1-minute historical forex data.")
    parser.add_argument("--pair", type=str, default="EURUSD", help="Forex pair (default: EURUSD)")
    parser.add_argument("--days", type=int, default=30, help="Number of days to go back (e.g. 30, 90, 365)")
    args = parser.parse_args()

    download_dukascopy(pair=args.pair, days=args.days)
