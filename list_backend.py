import os
b = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\backend"
for f in os.listdir(b):
    p = os.path.join(b, f)
    if os.path.isfile(p):
        print("Backend root file:", f)
