import os

backend_dir = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\backend"
for f in os.listdir(backend_dir):
    p = os.path.join(backend_dir, f)
    if os.path.isfile(p):
        print("Backend root file:", f)
