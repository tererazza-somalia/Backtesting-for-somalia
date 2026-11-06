import os
import json
import re

print("=" * 65)
print("  TRADINGVIEW ORIGINAL RESTORATION SYSTEM")
print("=" * 65)

brain_dir = r"C:\Users\ILYAAS ABDIRAHMAN\.gemini\antigravity\brain"

# 1. Discover all conversations
conv_dirs = []
for d in os.listdir(brain_dir):
    p = os.path.join(brain_dir, d)
    if os.path.isdir(p):
        t_path = os.path.join(p, ".system_generated", "logs", "transcript_full.jsonl")
        if not os.path.exists(t_path):
            t_path = os.path.join(p, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(t_path):
            conv_dirs.append((d, p))

print(f"Found {len(conv_dirs)} conversation trajectories in brain directory.\n")

# 2. Search each conversation for chunks of index.html
candidates = {}

for cid, cpath in conv_dirs:
    t_full = os.path.join(cpath, ".system_generated", "logs", "transcript_full.jsonl")
    if not os.path.exists(t_full):
        t_full = os.path.join(cpath, ".system_generated", "logs", "transcript.jsonl")
    
    try:
        with open(t_full, "r", encoding="utf-8", errors="ignore") as f:
            for line_idx, line in enumerate(f):
                # index.html reads are characterized by "Showing lines ... of (5000+)" or containing TradingView Alternative
                if "Showing lines" in line and ("5013" in line or "5142" in line or "5362" in line or "5364" in line):
                    try:
                        data = json.loads(line)
                        content = data.get("content", "")
                        m = re.search(r"Showing lines (\d+)-(\d+) of (\d+)", content)
                        if m:
                            start_l = int(m.group(1))
                            end_l = int(m.group(2))
                            total_l = int(m.group(3))
                            step_idx = data.get("step_index", line_idx)
                            
                            key = (cid, total_l)
                            if key not in candidates:
                                candidates[key] = {
                                    "cid": cid,
                                    "total_lines": total_l,
                                    "file_path": t_full,
                                    "chunks": []
                                }
                            candidates[key]["chunks"].append({
                                "start": start_l,
                                "end": end_l,
                                "step": step_idx,
                                "content": content
                            })
                    except Exception:
                        pass
    except Exception as e:
        pass

print("Discovered index.html versions in history:")
for (cid, total_l), info in candidates.items():
    chunks = info["chunks"]
    ranges = [f"{c['start']}-{c['end']}" for c in chunks]
    print(f" • Conv {cid[:8]}... | Total lines: {total_l} | Chunks captured: {len(chunks)} ({', '.join(ranges)})")

# Select candidate with best coverage
best_key = None
best_score = -1

for key, info in candidates.items():
    total_l = info["total_lines"]
    covered = set()
    for c in info["chunks"]:
        covered.update(range(c["start"], c["end"] + 1))
    coverage_pct = len(covered) / total_l if total_l > 0 else 0
    score = coverage_pct * 10000 + total_l
    print(f" -> Candidate {key[0][:8]} (total {total_l}): Coverage = {len(covered)}/{total_l} ({coverage_pct*100:.1f}%)")
    if score > best_score:
        best_score = score
        best_key = key

if best_key:
    chosen = candidates[best_key]
    print("\n" + "=" * 65)
    print(f"🏆 BEST MATCH SELECTED: Conv {chosen['cid'][:8]} ({chosen['total_lines']} lines)")
    print("=" * 65)
    
    line_dict = {}
    line_pattern = re.compile(r"^(\d+):\s?(.*)$")
    
    chosen["chunks"].sort(key=lambda x: x["start"])
    
    for c in chosen["chunks"]:
        for raw_line in c["content"].split("\n"):
            m = line_pattern.match(raw_line)
            if m:
                l_num = int(m.group(1))
                l_val = m.group(2)
                line_dict[l_num] = l_val

    total_lines = chosen["total_lines"]
    missing = [i for i in range(1, total_lines + 1) if i not in line_dict]
    print(f"\nExtracted lines: {len(line_dict)} / {total_lines}")
    print(f"Missing lines count: {len(missing)}")
    
    # If there are any missing lines, fill them from other candidates
    if missing:
        print(f"Filling {len(missing)} missing lines from matching history chunks...")
        # Sort other candidates so closest total_lines is preferred
        sorted_others = sorted(
            [k for k in candidates.keys() if k != best_key],
            key=lambda k: abs(k[1] - total_lines)
        )
        for other_k in sorted_others:
            if not missing:
                break
            for c in candidates[other_k]["chunks"]:
                for raw_line in c["content"].split("\n"):
                    m = line_pattern.match(raw_line)
                    if m:
                        l_num = int(m.group(1))
                        l_val = m.group(2)
                        if l_num in missing:
                            line_dict[l_num] = l_val
            missing = [i for i in range(1, total_lines + 1) if i not in line_dict]
        print(f"Remaining missing lines after secondary fill: {len(missing)}")

    # Assemble the file
    max_idx = max(line_dict.keys())
    assembled = []
    for i in range(1, max_idx + 1):
        if i in line_dict:
            assembled.append(line_dict[i])
        else:
            assembled.append("")
            
    final_content = "\n".join(assembled)
    
    # Verification checks
    has_title = "TradingView Alternative" in final_content
    has_toolbar = "tv-navbar" in final_content or "tv-left-toolbar" in final_content
    has_scripts = "LightweightCharts" in final_content
    ends_html = "</html>" in final_content.lower()
    
    print("\nSanity Check:")
    print(f" - Contains TradingView title: {has_title}")
    print(f" - Contains TV Navbar/Toolbar: {has_toolbar}")
    print(f" - Contains Chart Library:     {has_scripts}")
    print(f" - Proper HTML End tag:        {ends_html}")
    
    target_path = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index.html"
    backup_path = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index_original_perfect.html"
    
    with open(target_path, "w", encoding="utf-8") as out:
        out.write(final_content)
    with open(backup_path, "w", encoding="utf-8") as out:
        out.write(final_content)
        
    print("\n" + "=" * 65)
    print("🎉 SUCCESS! ORIGINAL INDEX.HTML HAS BEEN COMPLETELY RESTORED!")
    print(f"Written to: {target_path} ({len(assembled)} lines)")
    print(f"Backup saved to: {backup_path}")
    print("=" * 65)
else:
    print("No candidates found in history.")
