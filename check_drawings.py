import os

d = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\drawings"
if os.path.exists(d):
    for f in os.listdir(d):
        p = os.path.join(d, f)
        print("Drawings file:", f, f"({os.path.getsize(p)/1024:.1f} KB)")
else:
    print("drawings/ does not exist")
