import os

backend_dir = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\backend"
with open(r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\backend_files_list.txt", "w") as out:
    for f in os.listdir(backend_dir):
        out.write(f + "\n")
