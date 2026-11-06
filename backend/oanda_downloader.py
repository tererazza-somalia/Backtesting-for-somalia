"""
OANDA v20 REST API Downloader.
Downloads deep historical Forex candlestick data directly from OANDA's official servers.
Supports multi-year 1m, 5m, 15m, 1h, 4h, and daily historical data.

Usage:
    python oanda_downloader.py --pair EURUSD --timeframe 1m --days 30 --key YOUR_OANDA_API_KEY
    python oanda_downloader.py --pair EURUSD --timeframe 1m --days 365 --key YOUR_OANDA_API_KEY
    python oanda_downloader.py --pair XAUUSD --timeframe 4h --days 730 --key YOUR_OANDA_API_KEY
"""
import sys
import os
import argparse
from datetime import datetime, timedelta
import requests
import pandas as pd

# OANDA v20 Endpoints
OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com/v3"
OANDA_LIVE_URL = "https://api-fxtrade.oanda.com/v3"

# Granularity mapping
GRANULARITY_MAP = {
    "1m": "M1",
    "5m": "M5",
    "15m": "M15",
    "30m": "M30",
    "1h": "H1",
    "4h": "H4",
    "1d": "D",
    "1w": "W",
}


def format_oanda_instrument(pair: str) -> str:
    """Format EURUSD -> EUR_USD, XAUUSD -> XAU_USD."""
    pair_clean = pair.upper().replace("/", "").replace("_", "")
    if len(pair_clean) == 6:
        return f"{pair_clean[:3]}_{pair_clean[3:]}"
    return pair_clean


def fetch_oanda_candles(
    pair="EURUSD",
    timeframe="1m",
    days=30,
    api_key=None,
    is_live=False,
    output_dir="data",
):
    """
    Fetch historical candles from OANDA v20 API with auto-pagination.
    """
    if not api_key:
        api_key = os.getenv("OANDA_API_KEY")

    if not api_key:
        print("\n" + "=" * 65)
        print(" [!] Missing OANDA API Key.")
        print(" Pass your API key via:")
        print("     python oanda_downloader.py --key YOUR_KEY_HERE")
        print(" Or set an environment variable: set OANDA_API_KEY=YOUR_KEY_HERE")
        print("=" * 65 + "\n")
        return False

    base_url = OANDA_LIVE_URL if is_live else OANDA_PRACTICE_URL
    instrument = format_oanda_instrument(pair)
    granularity = GRANULARITY_MAP.get(timeframe.lower(), "M1")

    end_dt = datetime.utcnow()
    start_dt = end_dt - timedelta(days=days)

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept-Datetime-Format": "RFC3339",
    }

    print("\n" + "=" * 65)
    print(f"  OANDA v20 HISTORICAL DATA DOWNLOADER")
    print(f"  Instrument:  {instrument}")
    print(f"  Timeframe:   {timeframe.upper()} ({granularity})")
    print(f"  Date Range:  {start_dt.strftime('%Y-%m-%d')} -> {end_dt.strftime('%Y-%m-%d')} ({days} days)")
    print(f"  Server:      {'Live' if is_live else 'Practice / Demo'}")
    print("=" * 65)

    all_candles = []
    current_from = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    final_to = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    batch_num = 1

    print("\nDownloading batches from OANDA...")

    while True:
        url = f"{base_url}/instruments/{instrument}/candles"
        params = {
            "price": "M",  # Midpoint prices
            "granularity": granularity,
            "count": 5000,  # Max allowable batch per OANDA v20 request
            "from": current_from,
        }

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=20)
            if resp.status_code != 200:
                print(f"[!] OANDA Error ({resp.status_code}): {resp.text}")
                return False

            data = resp.json()
            candles = data.get("candles", [])
            if not candles:
                break

            for c in candles:
                if not c.get("complete", True):
                    continue  # Skip incomplete live bar
                mid = c["mid"]
                time_str = c["time"][:19].replace("T", " ")
                all_candles.append({
                    "Date": time_str,
                    "Open": float(mid["o"]),
                    "High": float(mid["h"]),
                    "Low": float(mid["l"]),
                    "Close": float(mid["c"]),
                    "Volume": int(c.get("volume", 0)),
                })

            last_time = candles[-1]["time"]
            print(f"  [Batch {batch_num}] Downloaded {len(candles)} candles up to {last_time[:19]}")

            # Check if we have reached the end date or if fewer than 5000 returned
            if len(candles) < 5000 or last_time >= final_to:
                break

            # Advance current_from by 1 second past last candle
            dt_last = datetime.strptime(last_time[:19], "%Y-%m-%dT%H:%M:%S")
            current_from = (dt_last + timedelta(seconds=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            batch_num += 1

        except Exception as e:
            print(f"[!] Request error: {e}")
            break

    if not all_candles:
        print("[!] No candles downloaded.")
        return False

    df = pd.DataFrame(all_candles)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.set_index("Date")
    df = df[~df.index.duplicated(keep="first")].sort_index()

    # Filter to requested range
    df = df[(df.index >= start_dt) & (df.index <= end_dt)]

    os.makedirs(output_dir, exist_ok=True)
    pair_clean = pair.upper().replace("/", "").replace("_", "")

    # If 1-minute, save to standard deep format so the app uses it automatically
    if timeframe.lower() == "1m":
        out_path = os.path.join(output_dir, f"{pair_clean}_1m_deep.csv")
    else:
        out_path = os.path.join(output_dir, f"{pair_clean}_{timeframe.lower()}_oanda.csv")

    df.to_csv(out_path)

    print("\n" + "-" * 65)
    print(f"  [✓] SUCCESS! Downloaded {len(df):,} OANDA candles.")
    print(f"  [✓] Saved to: {out_path}")
    print(f"  [✓] ilyaas backtesting will now use this authentic OANDA data!")
    print("-" * 65 + "\n")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download deep historical data from OANDA.")
    parser.add_argument("--pair", type=str, default="EURUSD", help="Forex pair (e.g. EURUSD, GBPUSD, XAUUSD)")
    parser.add_argument("--timeframe", type=str, default="1m", help="Timeframe: 1m, 5m, 15m, 1h, 4h, 1d")
    parser.add_argument("--days", type=int, default=30, help="Days of history to download (e.g. 30, 90, 365, 1000)")
    parser.add_argument("--key", type=str, default="", help="Your OANDA v20 API Key / Token")
    parser.add_argument("--live", action="store_true", help="Use live OANDA server instead of practice demo")
    args = parser.parse_args()

    fetch_oanda_candles(
        pair=args.pair,
        timeframe=args.timeframe,
        days=args.days,
        api_key=args.key,
        is_live=args.live,
    )
