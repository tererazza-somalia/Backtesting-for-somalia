import pandas as pd
import glob
import os
import re

downloads_dir = r"c:\Users\ILYAAS ABDIRAHMAN\Downloads"

# Find all extracted HistData CSV files in Downloads
pattern = os.path.join(downloads_dir, "**", "DAT_ASCII_*.csv")
files_found = glob.glob(pattern, recursive=True)

if not files_found:
    print("No DAT_ASCII_*.csv files found in Downloads!")
    exit()

print(f"Found {len(files_found)} HistData file(s) in Downloads.\n")

for file_path in files_found:
    filename = os.path.basename(file_path)
    
    # Extract year/date (e.g. 'DAT_ASCII_EURUSD_M1_2022.csv' -> '2022')
    match = re.search(r'M1_(\d+)', filename)
    tag = match.group(1) if match else "converted"
    
    output_file = os.path.join(downloads_dir, f"EURUSD_{tag}_ready.csv")
    
    # Skip if already converted
    if os.path.exists(output_file):
        print(f"--> Skipping {filename} (Already converted -> {os.path.basename(output_file)})")
        continue

    print(f"--> Converting: {filename}...")
    df = pd.read_csv(
        file_path,
        sep=";",
        header=None,
        names=["datetime_str", "open", "high", "low", "close", "volume"],
        dtype={"datetime_str": str, "open": float, "high": float, "low": float, "close": float}
    )
    
    dt_series = pd.to_datetime(df["datetime_str"], format="%Y%m%d %H%M%S", utc=True)
    df["time"] = (dt_series.astype("int64") // 10**9).astype(int)
    
    clean_df = df[["time", "open", "high", "low", "close"]].sort_values("time").drop_duplicates(subset=["time"])
    clean_df.to_csv(output_file, index=False)
    
    print(f"    SUCCESS! Saved {len(clean_df):,} candles -> {output_file}\n")

print("All done!")
