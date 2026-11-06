import os
import json
import shutil

appdata = os.environ.get("APPDATA", "")
code_history = os.path.join(appdata, "Code", "User", "History")

print(f"Checking VS Code history in: {code_history}...\n")

found_versions = []

if os.path.exists(code_history):
    for folder in os.listdir(code_history):
        folder_path = os.path.join(code_history, folder)
        entries_file = os.path.join(folder_path, "entries.json")
        if os.path.exists(entries_file):
            try:
                with open(entries_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    resource = data.get("resource", "")
                    if "index.html" in resource and "backtesting" in resource:
                        print(f"Found history folder for index.html: {folder}")
                        print(f"Resource: {resource}")
                        entries = data.get("entries", [])
                        for entry in entries:
                            eid = entry.get("id")
                            timestamp = entry.get("timestamp")
                            version_path = os.path.join(folder_path, eid)
                            if os.path.exists(version_path):
                                size = os.path.getsize(version_path)
                                found_versions.append((timestamp, version_path, size))
                                print(f"  Version: {eid} | Time: {timestamp} | Size: {size} bytes")
            except Exception as e:
                pass

if found_versions:
    # Sort by timestamp (newest first, or let's inspect the older versions before today!)
    found_versions.sort(key=lambda x: x[0], reverse=True)
    print(f"\nTotal history versions found: {len(found_versions)}")
    
    # Save a copy of the previous version!
    # Let's inspect the version from before our session or the largest one!
    for i, (ts, vpath, sz) in enumerate(found_versions):
        with open(vpath, "r", encoding="utf-8", errors="ignore") as vf:
            preview = vf.read(300)
            print(f"\n--- Version {i+1} (Size: {sz} bytes) ---")
            print(preview[:200].replace("\n", " "))
            
            # If it contains drawings or InteractionController, this is the one!
            with open(vpath, "r", encoding="utf-8", errors="ignore") as full_f:
                full_text = full_f.read()
                if "drawings" in full_text or "InteractionController" in full_text or "TrendingUp" in full_text:
                    out_recovered = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index_recovered.html"
                    shutil.copyfile(vpath, out_recovered)
                    print(f"\n🏆 RESTORED ORIGINAL FILE TO: {out_recovered}!")
else:
    print("No VS Code history entries found for index.html")
