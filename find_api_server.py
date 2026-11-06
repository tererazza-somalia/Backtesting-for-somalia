import os

base = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting"

print("Searching for backend API server...")
for root, dirs, files in os.walk(base):
    if "venv" in root or "node_modules" in root or ".next" in root:
        continue
    for f in files:
        if f.endswith(".py"):
            p = os.path.join(root, f)
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as file:
                    txt = file.read()
                    if "/api/candles" in txt or "Flask(" in txt or "FastAPI(" in txt:
                        print(f"FOUND API SERVER: {p}")
            except Exception:
                pass
