import os

base = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting"

print("Searching for files that import or use InteractionController.js...")

for root, dirs, files in os.walk(base):
    if "venv" in root or "node_modules" in root or ".next" in root:
        continue
    for f in files:
        if f.endswith(('.html', '.js')):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
                    if "InteractionController" in content or "RectangleDrawing" in content:
                        print(f"--> FOUND REFERENCE IN: {p}")
            except Exception:
                pass
