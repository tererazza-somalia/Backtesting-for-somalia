import os

appdata = os.environ.get("APPDATA", "")
history_dirs = [
    os.path.join(appdata, "Code", "User", "History"),
    os.path.join(appdata, "Antigravity", "User", "History"),
    os.path.join(os.environ.get("USERPROFILE", ""), ".gemini"),
    os.path.join(os.environ.get("USERPROFILE", ""), ".vscode")
]

phrase = "SHORT POSITION: Click chart to place setup".lower()

print("=== Checking VS Code / IDE Local History Backups ===")

found = []
for hdir in history_dirs:
    if not os.path.exists(hdir):
        continue
    print(f"Scanning history in: {hdir}...")
    for root, dirs, files in os.walk(hdir):
        for f in files:
            p = os.path.join(root, f)
            try:
                if os.path.getsize(p) < 5 * 1024 * 1024:
                    with open(p, "r", encoding="utf-8", errors="ignore") as file:
                        txt = file.read().lower()
                        if phrase in txt or "tradingview alternative" in txt:
                            found.append(p)
                            print(f"\n🎉 FOUND PREVIOUS VERSION IN HISTORY: {p}")
            except Exception:
                pass

if not found:
    print("\nNo history backups found in standard VS Code paths.")
else:
    print(f"\nFound {len(found)} backup copies in local history!")
