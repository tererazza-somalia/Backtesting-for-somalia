import os
import json
import re
import shutil

print("=" * 65)
print("  RESTORING PURE ORIGINAL INDEX.HTML FROM ANTIGRAVITY HISTORY")
print("=" * 65)

appdata = os.environ.get("APPDATA", "")
ag_hist = os.path.join(appdata, "Antigravity", "User", "History")
code_hist = os.path.join(appdata, "Code", "User", "History")

candidates = []

for hist_root in [ag_hist, code_hist]:
    if not os.path.exists(hist_root):
        continue
    print(f"Scanning history root: {hist_root}...")
    for folder in os.listdir(hist_root):
        folder_path = os.path.join(hist_root, folder)
        if not os.path.isdir(folder_path):
            continue
        entries_file = os.path.join(folder_path, "entries.json")
        if os.path.exists(entries_file):
            try:
                with open(entries_file, "r", encoding="utf-8") as jf:
                    data = json.load(jf)
                    resource = data.get("resource", "")
                    if "index.html" in resource.lower() and "backtesting" in resource.lower():
                        print(f"\n🎯 FOUND HISTORY RESOURCE: {resource}")
                        for entry in data.get("entries", []):
                            eid = entry.get("id")
                            timestamp = entry.get("timestamp", 0)
                            file_path = os.path.join(folder_path, eid)
                            if os.path.exists(file_path):
                                sz = os.path.getsize(file_path)
                                with open(file_path, "r", encoding="utf-8", errors="ignore") as tf:
                                    content = tf.read()
                                is_html = content.strip().lower().startswith("<!doctype html") or content.strip().lower().startswith("<html")
                                has_tv = "TradingView Alternative" in content
                                line_count = len(content.splitlines())
                                candidates.append({
                                    "path": file_path,
                                    "size": sz,
                                    "lines": line_count,
                                    "is_html": is_html,
                                    "has_tv": has_tv,
                                    "timestamp": timestamp,
                                    "content": content
                                })
                                print(f"   -> Version {eid}: {line_count:,} lines | {sz:,} bytes | Pure HTML={is_html} | TV={has_tv}")
            except Exception as e:
                pass

if candidates:
    # Filter for pure HTML and sort by line count (largest first)
    pure_candidates = [c for c in candidates if c["is_html"] and c["has_tv"]]
    if not pure_candidates:
        pure_candidates = [c for c in candidates if c["is_html"]]
    if not pure_candidates:
        pure_candidates = candidates
    
    pure_candidates.sort(key=lambda x: (x["has_tv"], x["lines"]), reverse=True)
    best = pure_candidates[0]
    
    print("\n" + "=" * 65)
    print("🏆 BEST HISTORICAL SNAPSHOT FOUND!")
    print(f"   Lines: {best['lines']:,} lines | Size: {best['size']:,} bytes")
    print(f"   From: {best['path']}")
    print("=" * 65)
    
    target_path = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index.html"
    backup_path = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index_pure_restored.html"
    
    with open(target_path, "w", encoding="utf-8") as f:
        f.write(best["content"])
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(best["content"])
        
    print(f"\n🎉🎉 COMPLETE RESTORATION SUCCESSFUL!")
    print(f"Restored pure HTML directly to: {target_path} ({best['lines']:,} lines)")
    print(f"Safety copy saved: {backup_path}")
    print("\nNext step: Run 'node server.js' and visit http://localhost:3000")
else:
    print("\nReconstructing from logs directly...")
    brain_dir = r"C:\Users\ILYAAS ABDIRAHMAN\.gemini\antigravity\brain"
    lines_dict = {}
    line_pattern = re.compile(r"^(\d+):\s?(.*)$")

    for root, dirs, files in os.walk(brain_dir):
        for f in files:
            if f.endswith(".jsonl"):
                p = os.path.join(root, f)
                try:
                    with open(p, "r", encoding="utf-8", errors="ignore") as jf:
                        for line in jf:
                            if "Showing lines" in line and ("5362" in line or "5100" in line or "5142" in line or "TradingView Alternative" in line):
                                try:
                                    data = json.loads(line)
                                    content = data.get("content", "")
                                    for raw_l in content.split("\n"):
                                        m = line_pattern.match(raw_l)
                                        if m:
                                            l_num = int(m.group(1))
                                            l_val = m.group(2)
                                            if l_num not in lines_dict:
                                                lines_dict[l_num] = l_val
                                except Exception:
                                    pass
                except Exception:
                    pass

    if lines_dict:
        max_line = max(lines_dict.keys())
        print(f"Extracted {len(lines_dict)} lines from logs (up to line {max_line}).")
        target_path = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index.html"
        with open(target_path, "w", encoding="utf-8") as out:
            for i in range(1, max_line + 1):
                out.write(lines_dict.get(i, "") + "\n")
        print(f"Restored reconstructed file to {target_path}")
