import os
import json
import urllib.parse

appdata = os.environ.get("APPDATA", "")
ag_hist = os.path.join(appdata, "Antigravity", "User", "History")
code_hist = os.path.join(appdata, "Code", "User", "History")

print("Checking ALL resources in Antigravity & Code history:")

for hname, hpath in [("Antigravity", ag_hist), ("Code", code_hist)]:
    if not os.path.exists(hpath):
        continue
    for folder in os.listdir(hpath):
        fp = os.path.join(hpath, folder)
        ej = os.path.join(fp, "entries.json")
        if os.path.exists(ej):
            try:
                with open(ej, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    raw_res = d.get("resource", "")
                    decoded = urllib.parse.unquote(raw_res)
                    if "index.html" in decoded.lower() or "backtesting" in decoded.lower() or "html" in decoded.lower():
                        print(f"\n[{hname}] Folder: {folder}")
                        print(f"  Decoded Resource: {decoded}")
                        for e in d.get("entries", []):
                            fid = e.get("id")
                            fpath = os.path.join(fp, fid)
                            sz = os.path.getsize(fpath) if os.path.exists(fpath) else 0
                            print(f"    File: {fid} | Size: {sz:,} bytes | Timestamp: {e.get('timestamp')}")
            except Exception as e:
                pass
