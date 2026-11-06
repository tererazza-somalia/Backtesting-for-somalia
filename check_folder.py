import os
import pandas as pd

folder = r"C:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\chart-eurousd"

if not os.path.exists(folder):
    print(f"Directory does not exist: {folder}")
    exit()

items = os.listdir(folder)
print(f"=== Checking Folder: {folder} ===")
print(f"Total items found: {len(items)}\n")

if len(items) == 0:
    print("Folder is currently empty!")
    exit()

for item in items:
    path = os.path.join(folder, item)
    if os.path.isdir(path):
        print(f"[DIR]  {item}")
    else:
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"[FILE] {item} ({size_mb:.2f} MB)")
        
        # If it's a CSV, check the first few lines and columns
        if item.endswith(".csv"):
            try:
                df = pd.read_csv(path, nrows=5)
                print(f"       Columns: {list(df.columns)}")
                print(f"       Sample row: {df.iloc[0].to_dict()}")
                
                # Validation check
                expected = ["time", "open", "high", "low", "close"]
                if list(df.columns) == expected:
                    print("       Status: [OK] Formatted perfectly for TradingView Lightweight Charts!")
                else:
                    print(f"       Status: [WARNING] Columns do not match expected {expected}")
            except Exception as e:
                print(f"       Error reading CSV: {e}")
        print()
