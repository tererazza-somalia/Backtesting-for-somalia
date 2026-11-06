import os
import json

brain_dir = r"C:\Users\ILYAAS ABDIRAHMAN\.gemini\antigravity\brain"

conversations = []

for item in os.listdir(brain_dir):
    p = os.path.join(brain_dir, item)
    if os.path.isdir(p):
        transcript = os.path.join(p, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(transcript):
            first_user_msg = ""
            created_at = ""
            try:
                with open(transcript, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        data = json.loads(line)
                        if data.get("type") == "USER_INPUT":
                            first_user_msg = data.get("content", "")[:120].replace("\n", " ")
                            created_at = data.get("created_at", "")
                            break
            except Exception:
                pass
            conversations.append({
                "id": item,
                "created_at": created_at,
                "first_msg": first_user_msg
            })

conversations.sort(key=lambda x: x["created_at"])

print(f"Total conversations found: {len(conversations)}\n")
for c in conversations:
    print(f"[{c['created_at']}] {c['id']}")
    print(f"   Prompt: {c['first_msg']}\n")
