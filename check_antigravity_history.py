import os
import json
import shutil

appdata = os.environ.get("APPDATA", "")
user_home = os.environ.get("USERPROFILE", "")

history_dirs = [
    os.path.join(appdata, "Antigravity", "User", "History"),
    os.path.join(appdata, "Code", "User", "History"),
    os.path.join(user_home, ".gemini", "antigravity"),
]

print("=== Checking Antigravity / IDE History for any HTML files ===")

found_files = []

for hdir in history_dirs:
    if not os.path.exists(hdir):
        continue
    print(f"Scanning: {hdir}...")
    for root, dirs, files in os.walk(hdir):
        for f in files:
            p = os.path.join(root, f)
            try:
                # Check files that look like HTML or JS
                if os.path.getsize(p) < 5 * 1024 * 1024:
                    with open(p, "r", encoding="utf-8", errors="ignore") as file:
                        txt = file.read()
                        if "InteractionController" in txt or "SHORT POSITION" in txt or "TradingView Alternative" in txt:
                            found_files.append((p, os.path.getsize(p)))
                            print(f"\n🎉 FOUND BACKUP FILE in {root}:")
                            print(f"   Path: {p} (Size: {os.path.getsize(p)} bytes)")
            except Exception:
                pass

if found_files:
    # Pick the best candidate (usually the largest HTML file or the one not in drawings/)
    candidates = [f for f in found_files if not f[0].endswith("InteractionController.js")]
    if candidates:
        best_path = candidates[0][0]
        restore_dest = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\original_restored.html"
        shutil.copyfile(best_path, restore_dest)
        print(f"\n🏆 COPIED BACKUP TO: {restore_dest}")
    else:
        print("Only InteractionController.js matched. Let's check entries.json in Antigravity.")
else:
    print("\nLet's scan Antigravity entries.json directly...")
    ag_hist = os.path.join(appdata, "Antigravity", "User", "History")
    if os.path.exists(ag_hist):
        for folder in os.listdir(ag_hist):
            fpath = os.path.join(ag_hist, folder)
            ej = os.path.join(fpath, "entries.json")
            if os.path.exists(ej):
                try:
                    with open(ej, "r", encoding="utf-8") as jf:
                        d = json.load(jf)
                        res = d.get("resource", "")
                        if "backtesting" in res:
                            print(f"History resource: {res}")
                            for entry in d.get("entries", []):
                                eid = entry.get("id")
                                print(f"  -> File ID: {eid} in {folder}")
                except Exception:
                    pass
