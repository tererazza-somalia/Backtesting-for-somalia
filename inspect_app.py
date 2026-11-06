import os

base = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting"

for sub in ["drawings", "frontend", "backend"]:
    sub_path = os.path.join(base, sub)
    print(f"\n=== Inside {sub}/ ===")
    if os.path.exists(sub_path):
        for root, dirs, files in os.walk(sub_path):
            rel = os.path.relpath(root, base)
            print(f"[{rel}]")
            for f in files:
                fpath = os.path.join(root, f)
                size_kb = os.path.getsize(fpath) / 1024
                print(f"   - {f} ({size_kb:.1f} KB)")
    else:
        print("Directory does not exist.")
