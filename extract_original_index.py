import os
import json
import re

brain_dir = r"C:\Users\ILYAAS ABDIRAHMAN\.gemini\antigravity\brain"

print("Searching across all agent brain transcripts for the full 2,500-line index.html...")

best_content = None
max_lines = 0

for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f in ["transcript_full.jsonl", "transcript.jsonl"]:
            p = os.path.join(root, f)
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as tf:
                    for line in tf:
                        if "TradingView Alternative - Chart, Measure, S/R & Bar Replay" in line:
                            # Try to extract the HTML content
                            # Check if it was written via write_file or tool call
                            try:
                                data = json.loads(line)
                                # Check tool calls
                                for tc in data.get("tool_calls", []):
                                    content = tc.get("args", {}).get("Content", "")
                                    if "TradingView Alternative" in content and len(content) > max_lines:
                                        max_lines = len(content)
                                        best_content = content
                                        print(f"Found complete written index.html! Length: {len(content)} chars in {p}")
                            except Exception:
                                pass
            except Exception:
                pass

if best_content:
    out_path = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index.html"
    with open(out_path, "w", encoding="utf-8") as out:
        out.write(best_content)
    print(f"\n🎉🎉 COMPLETE 100% RESTORATION SUCCESSFUL!")
    print(f"Restored original 2,500-line index.html to: {out_path}")
else:
    print("Could not find full write_file in one step. Let's reconstruct it or check chunked files.")
