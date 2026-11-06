import os

desktop = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop"
print(f"=== Folders & Files on Desktop ({desktop}) ===")

try:
    items = os.listdir(desktop)
    for item in items:
        p = os.path.join(desktop, item)
        if os.path.isdir(p):
            print(f"[FOLDER] {item}")
        else:
            print(f"[FILE]   {item}")
except Exception as e:
    print(f"Error: {e}")

print("\n=== Inside Desktop/backtesting ===")
bt = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting"
try:
    for item in os.listdir(bt):
        p = os.path.join(bt, item)
        if os.path.isdir(p):
            print(f"[FOLDER] {item}")
        else:
            print(f"[FILE]   {item}")
except Exception as e:
    print(f"Error: {e}")
