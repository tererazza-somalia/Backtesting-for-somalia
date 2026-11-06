import os
import json
import shutil

appdata = os.environ.get("APPDATA", "")
ag_history = os.path.join(appdata, "Antigravity", "User", "History")
code_history = os.path.join(appdata, "Code", "User", "History")

print("=" * 65)
print("  LOCATING PURE HTML BACKUP (NOT JSONL CHUNKS)")
print("=" * 65)

html_candidates = []

for hdir_name, hdir in [("Antigravity History", ag_history), ("VS Code History", code_history)]:
    if not os.path.exists(hdir):
        continue
    print(f"Scanning {hdir_name}...")
    for root, dirs, files in os.walk(hdir):
        for f in files:
            if f.endswith((".json", ".jsonl")):
                continue
            p = os.path.join(root, f)
            try:
                sz = os.path.getsize(p)
                if sz > 20000: # at least 20KB
                    with open(p, "r", encoding="utf-8", errors="ignore") as file:
                        start = file.read(200).strip()
                        if start.lower().startswith("<!doctype html") or start.lower().startswith("<html"):
                            rest = file.read(50000)
                            if "TradingView Alternative" in rest:
                                with open(p, "r", encoding="utf-8", errors="ignore") as full_f:
                                    lines = full_f.readlines()
                                num_lines = len(lines)
                                has_drawings = "drawings/index.js" in rest or "drawings/ui/drawing.css" in rest
                                html_candidates.append({
                                    "path": p,
                                    "size": sz,
                                    "lines": num_lines,
                                    "has_drawings": has_drawings,
                                    "preview": lines[5].strip() if len(lines) > 5 else ""
                                })
                                print(f"  ⭐ Found Pure HTML File: {p} ({num_lines} lines, {sz:,} bytes, drawings={has_drawings})")
            except Exception:
                pass

# Also check Desktop and Downloads for any .html files
for base in [r"c:\Users\ILYAAS ABDIRAHMAN\Desktop", r"c:\Users\ILYAAS ABDIRAHMAN\Downloads"]:
    if os.path.exists(base):
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'venv', '.next', '__pycache__']]
            for f in files:
                if f.endswith(".html") and f != "index.html":
                    p = os.path.join(root, f)
                    try:
                        sz = os.path.getsize(p)
                        if sz > 20000:
                            with open(p, "r", encoding="utf-8", errors="ignore") as file:
                                txt = file.read(2000)
                                if "TradingView Alternative" in txt:
                                    with open(p, "r", encoding="utf-8", errors="ignore") as full_f:
                                        lines = full_f.readlines()
                                    num_lines = len(lines)
                                    has_drawings = "drawings/index.js" in txt
                                    html_candidates.append({
                                        "path": p,
                                        "size": sz,
                                        "lines": num_lines,
                                        "has_drawings": has_drawings,
                                        "preview": lines[5].strip() if len(lines) > 5 else ""
                                    })
                                    print(f"  ⭐ Found HTML File on Disk: {p} ({num_lines} lines, {sz:,} bytes)")
                    except Exception:
                        pass

if html_candidates:
    # Pick the one with the most lines and has_drawings
    html_candidates.sort(key=lambda x: (x["has_drawings"], x["lines"]), reverse=True)
    winner = html_candidates[0]
    
    print("\n" + "=" * 65)
    print(f"🏆 PURE HTML RESTORATION SOURCE:")
    print(f"   Source: {winner['path']}")
    print(f"   Lines: {winner['lines']} lines | Size: {winner['size']:,} bytes")
    print("=" * 65)
    
    target = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index.html"
    shutil.copyfile(winner["path"], target)
    print(f"\n🎉 Successfully restored pure HTML file to: {target}")
else:
    print("\nNo standalone pure HTML file found directly in History.")
    print("Extracting pure HTML directly from the agent conversation transcript...")
    # We can reconstruct it from the transcript log directly!
    # Let's inspect conversation 8faf3b4c-ffe0-49d1-a1c5-3f3a9cddffc0 or b8b7521e-bc0a-4f8d-bb38-f6c04b235cc3
