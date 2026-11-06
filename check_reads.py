import os
import json

path_8faf = r"C:\Users\ILYAAS ABDIRAHMAN\.gemini\antigravity\brain\8faf3b4c-ffe0-49d1-a1c5-3f3a9cddffc0\.system_generated\logs\transcript_full.jsonl"

print("Checking read_file tool calls on index.html in 8faf3b4c...")
with open(path_8faf, "r", encoding="utf-8", errors="ignore") as f:
    for idx, line in enumerate(f):
        if "read_file" in line and "index.html" in line:
            try:
                data = json.loads(line)
                for tc in data.get("tool_calls", []):
                    if "index.html" in str(tc.get("args", {})):
                        print(f"Line {idx+1} | step {data.get('step_index')}: {tc.get('args')}")
            except Exception:
                pass
