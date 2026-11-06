import os
import json
import re

brain = r"C:\Users\ILYAAS ABDIRAHMAN\.gemini\antigravity\brain"

print("Searching for selectTrendline and lines 4400-4700...")

found_lines = {}

for root, dirs, files in os.walk(brain):
    for f in files:
        if f.endswith(".jsonl"):
            p = os.path.join(root, f)
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as file:
                    for line_idx, line in enumerate(file):
                        if "selectTrendline" in line or "4400" in line:
                            try:
                                data = json.loads(line)
                                content = data.get("content", "")
                                if not content and "tool_calls" in data:
                                    for tc in data.get("tool_calls", []):
                                        content += str(tc)
                                
                                # Check if it has lines
                                for raw_l in content.split("\n"):
                                    m = re.match(r"^(\d+):\s?(.*)$", raw_l)
                                    if m:
                                        l_num = int(m.group(1))
                                        l_text = m.group(2)
                                        if 4390 <= l_num <= 4710:
                                            found_lines[l_num] = l_text
                            except Exception:
                                pass
            except Exception:
                pass

print(f"Found {len(found_lines)} lines in range 4390-4710:")
sorted_nums = sorted(found_lines.keys())
print("Covered lines:", [f"{min(sorted_nums)}-{max(sorted_nums)}"] if sorted_nums else "None")
missing = [n for n in range(4400, 4701) if n not in found_lines]
print(f"Missing lines: {len(missing)}")
if missing:
    print(f"Missing ranges: {missing[:10]} ... {missing[-10:]}")
for n in sorted_nums[:30]:
    print(f"{n}: {found_lines[n]}")
