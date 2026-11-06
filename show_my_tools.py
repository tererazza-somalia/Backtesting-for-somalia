import os

base = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting"

print("==================================================")
print("  YOUR ORIGINAL PROJECT FILES (IGNORING VENV)")
print("==================================================\n")

for target in ["drawings", "frontend", "backend"]:
    target_path = os.path.join(base, target)
    print(f"📁 FOLDER: {target}/")
    if os.path.exists(target_path):
        for root, dirs, files in os.walk(target_path):
            # Skip virtual environments and caches
            if "venv" in root or "__pycache__" in root or "node_modules" in root:
                continue
            rel = os.path.relpath(root, base)
            print(f"  [{rel}]")
            for f in files:
                fpath = os.path.join(root, f)
                size_kb = os.path.getsize(fpath) / 1024
                print(f"    ⭐ {f} ({size_kb:.1f} KB)")
    else:
        print("    (Folder not found)")
    print()
