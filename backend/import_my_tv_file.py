"""
Quick script to import the user's exported TradingView file into the backtest engine data folder.
Aligns forex 17:00 NY / 21:00 UTC session start to TradingView's official calendar date.
"""
import os
import pandas as pd

source_file = r"C:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\chart-eurousd\OANDA_EURUSD, 1D.csv"
target_dir = os.path.join(os.path.dirname(__file__), "data")
target_file = os.path.join(target_dir, "EURUSD_1d_tv.csv")

os.makedirs(target_dir, exist_ok=True)

if not os.path.exists(source_file):
    print(f"Error: Source file not found at {source_file}")
    exit(1)

print(f"Reading {source_file}...")
df = pd.read_csv(source_file)

# Standardize columns
col_map = {}
for c in df.columns:
    cl = c.strip().lower()
    if cl in ("time", "date", "timestamp"):
        col_map[c] = "Date"
    elif cl == "open":
        col_map[c] = "Open"
    elif cl == "high":
        col_map[c] = "High"
    elif cl == "low":
        col_map[c] = "Low"
    elif cl == "close":
        col_map[c] = "Close"
    elif cl == "volume":
        col_map[c] = "Volume"

df = df.rename(columns=col_map)

# Convert unix seconds to UTC datetime, then add 4 hours to align 21:00 UTC forex session to TradingView's calendar trading date
dt_series = pd.to_datetime(df["Date"].astype(float), unit="s", utc=True)
df["Date"] = (dt_series + pd.Timedelta(hours=4)).dt.strftime("%Y-%m-%d")

df = df.set_index("Date").sort_index()
df = df[~df.index.duplicated(keep="first")]

# Clamp OHLC
df["High"] = df[["High", "Open", "Close"]].max(axis=1)
df["Low"]  = df[["Low",  "Open", "Close"]].min(axis=1)

cols = ["Open", "High", "Low", "Close"]
if "Volume" in df.columns:
    cols.append("Volume")

df = df[cols]
df.to_csv(target_file)
print(f"SUCCESS! Successfully imported {len(df)} authentic OANDA TradingView bars to:")
print(f"  {target_file}")
print(f"Range: {df.index[0]} -> {df.index[-1]}")
print(f"July 15 Bar: {df.loc['2026-07-15'].to_dict() if '2026-07-15' in df.index else 'N/A'}")
