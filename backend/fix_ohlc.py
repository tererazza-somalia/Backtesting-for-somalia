"""
One-time repair script: clamps OHLC data in all existing CSVs.
Fixes Yahoo Finance bars where High < Open/Close or Low > Open/Close.
Safe to run multiple times.
"""
import pandas as pd
import os
import glob

data_dir = os.path.join(os.path.dirname(__file__), "data")
csvs = glob.glob(os.path.join(data_dir, "*.csv"))

if not csvs:
    print("No CSV files found in", data_dir)
    exit()

print(f"Scanning {len(csvs)} CSV files in {data_dir}...\n")

total_fixed = 0

for fp in sorted(csvs):
    name = os.path.basename(fp)
    try:
        df = pd.read_csv(fp, index_col=0, parse_dates=True)
        required = {"Open", "High", "Low", "Close"}
        if not required.issubset(df.columns):
            print(f"  SKIP  {name}  (missing OHLC columns)")
            continue

        bad_high = ((df["High"] < df["Open"]) | (df["High"] < df["Close"])).sum()
        bad_low  = ((df["Low"]  > df["Open"]) | (df["Low"]  > df["Close"])).sum()
        total_bad = bad_high + bad_low

        if total_bad > 0:
            df["High"] = df[["High", "Open", "Close"]].max(axis=1)
            df["Low"]  = df[["Low",  "Open", "Close"]].min(axis=1)
            df.to_csv(fp)
            print(f"  FIXED {name}  ({bad_high} bad High, {bad_low} bad Low  → repaired)")
            total_fixed += total_bad
        else:
            print(f"  OK    {name}")

    except Exception as e:
        print(f"  ERROR {name}: {e}")

print(f"\nDone. {total_fixed} bad bars fixed across all files.")
