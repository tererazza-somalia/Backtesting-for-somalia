import os
import json

brain = r"C:\Users\ILYAAS ABDIRAHMAN\.gemini\antigravity\brain"

print("Searching for write_file tool calls that created index.html...")

writes = []

for root, dirs, files in os.walk(brain):
    for f in files:
        if f.endswith(".jsonl"):
            p = os.path.join(root, f)
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as jf:
                    for line in jf:
                        if "write_file" in line and "index.html" in line:
                            try:
                                data = json.loads(line)
                                for tc in data.get("tool_calls", []):
                                    if tc.get("name") == "write_file":
                                        args = tc.get("args", {})
                                        path = args.get("Path", "")
                                        if "index.html" in path:
                                            content = args.get("Content", "")
                                            writes.append((p, len(content), content[:100]))
                                            print(f"🔥 FOUND WRITE_FILE in {p}: size {len(content):,} chars")
                            except Exception:
                                pass
            except Exception:
                pass

print(f"Total write_file matches found: {len(writes)}")
