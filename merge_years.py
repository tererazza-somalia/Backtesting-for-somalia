import pandas as pd
import os
import glob

folder = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\chart-eurousd"
output_file = os.path.join(folder, "EURUSD_2020_2025_6Years.csv")

# Years to merge in chronological order
years = [2020, 2021, 2022, 2023, 2024, 2025]
dataframes = []

print("=== Merging 2020 to 2025 EUR/USD Data ===")

for y in years:
    file_path = os.path.join(folder, f"EURUSD_{y}_year.csv")
    if os.path.exists(file_path):
        print(f"Loading Year {y}: {os.path.basename(file_path)}...")
        df = pd.read_csv(file_path)
        dataframes.append(df)
        print(f"  -> {len(df):,} candles added.")
    else:
        print(f"Warning: File not found for year {y}: {file_path}")

if not dataframes:
    print("No files found to merge!")
    exit()

print("\nCombining all years and sorting chronologically...")
master_df = pd.concat(dataframes, ignore_index=True)

# Sort by time and remove any duplicate timestamps
master_df = master_df.sort_values("time").drop_duplicates(subset=["time"]).reset_index(drop=True)

print(f"Saving merged master dataset ({len(master_df):,} total candles)...")
master_df.to_csv(output_file, index=False)

size_mb = os.path.getsize(output_file) / (1024 * 1024)
print(f"\nSUCCESS! 6-Year Master File Created:")
print(f"Path: {output_file}")
print(f"Total Candles: {len(master_df):,}")
print(f"File Size: {size_mb:.2f} MB")
print("\nFirst row:", master_df.iloc[0].to_dict())
print("Last row: ", master_df.iloc[-1].to_dict())
