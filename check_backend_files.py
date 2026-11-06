import os

backend_dir = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\backend"
files = [f for f in os.listdir(backend_dir) if os.path.isfile(os.path.join(backend_dir, f))]
print("Files directly in backend/:")
for f in files:
    print(" -", f)
