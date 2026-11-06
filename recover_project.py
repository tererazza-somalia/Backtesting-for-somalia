import os
import glob

print("==================================================")
print("  SEARCHING EVERYWHERE FOR YOUR EXACT SCREENSHOT  ")
print("==================================================")

phrases = [
    "SHORT POSITION: Click chart to place setup".lower(),
    "drag to set target & stop".lower(),
    "TradingView Alternative".lower(),
    "drag to set target".lower()
]

# 1. Check all Desktop and Downloads folders
search_roots = [
    r"c:\Users\ILYAAS ABDIRAHMAN\Desktop",
    r"c:\Users\ILYAAS ABDIRAHMAN\Downloads",
    os.path.join(os.environ.get("APPDATA", ""), "Code", "User", "History"),
    os.path.join(os.environ.get("APPDATA", ""), "Antigravity", "User", "History"),
    r"c:\Users\ILYAAS ABDIRAHMAN\Projects",
    r"c:\Users\ILYAAS ABDIRAHMAN\Documents"
]

found = []

for root_dir in search_roots:
    if not os.path.exists(root_dir):
        continue
    print(f"Searching in: {root_dir}...")
    for root, dirs, files in os.walk(root_dir):
        # Ignore heavy build folders
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'venv', '__pycache__']]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in ['.html', '.js', '.jsx', '.ts', '.tsx', '.txt', '']:
                p = os.path.join(root, f)
                try:
                    if os.path.getsize(p) > 8 * 1024 * 1024:
                        continue
                    with open(p, "r", encoding="utf-8", errors="ignore") as file:
                        txt = file.read().lower()
                        for ph in phrases:
                            if ph in txt:
                                found.append((p, ph))
                                print(f"\n🔥🔥 FOUND EXACT FILE:")
                                print(f"   -> Path: {p}")
                                print(f"   -> Matched: '{ph}'\n")
                                break
                except Exception:
                    pass

print("\n--------------------------------------------------")
if found:
    print(f"SUCCESS! Found {len(found)} location(s) containing your exact tools!")
else:
    print("Could not find that exact phrase. Let's check other html files on your PC.")
print("--------------------------------------------------")
