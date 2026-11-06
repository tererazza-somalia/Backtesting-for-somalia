import os

search_paths = [
    r"c:\Users\ILYAAS ABDIRAHMAN\Desktop",
    r"c:\Users\ILYAAS ABDIRAHMAN\Downloads",
]

phrases = [
    "SHORT POSITION: Click chart to place setup",
    "Click chart to place setup",
    "TradingView Alternative",
    "drag to set target & stop",
    "drag to set target"
]

print("Scanning for the exact code in your screenshot...")

matches = []

for base in search_paths:
    if not os.path.exists(base):
        continue
    for root, dirs, files in os.walk(base):
        # Skip heavy folders
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'venv', '.next', '__pycache__']]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in ['.html', '.js', '.jsx', '.ts', '.tsx', '.vue', '.php']:
                p = os.path.join(root, f)
                try:
                    if os.path.getsize(p) > 5 * 1024 * 1024:
                        continue
                    with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                        content = file.read()
                        for phrase in phrases:
                            if phrase.lower() in content.lower():
                                matches.append((p, phrase))
                                print(f"🔥 FOUND IT! {p} (matched: '{phrase}')")
                                break
                except Exception:
                    pass

if not matches:
    print("Could not find exact phrase in Desktop or Downloads. Searching wider in user profile...")
    user_home = r"c:\Users\ILYAAS ABDIRAHMAN"
    # Search common developer folders: Projects, Documents, Source, repos
    for sub in ["Documents", "Projects", "source", "repos"]:
        sub_path = os.path.join(user_home, sub)
        if os.path.exists(sub_path):
            print(f"Scanning {sub_path}...")
            for root, dirs, files in os.walk(sub_path):
                dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'venv', '.next', '__pycache__']]
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in ['.html', '.js', '.jsx', '.ts', '.tsx']:
                        p = os.path.join(root, f)
                        try:
                            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                                content = file.read()
                                for phrase in phrases:
                                    if phrase.lower() in content.lower():
                                        matches.append((p, phrase))
                                        print(f"🔥 FOUND IT! {p}")
                                        break
                        except Exception:
                            pass
