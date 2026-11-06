import os

search_dirs = [
    r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting",
    r"c:\Users\ILYAAS ABDIRAHMAN\Desktop",
    r"c:\Users\ILYAAS ABDIRAHMAN\Downloads"
]

keywords = ["trendline", "trend_line", "long", "short", "drawing", "position", "risk"]
extensions = [".html", ".js", ".jsx", ".ts", ".tsx", ".py"]

print("=== Searching for your files with Trendlines, Long/Short tools... ===\n")

found_files = []

for base_dir in search_dirs:
    if not os.path.exists(base_dir):
        continue
    for root, dirs, files in os.walk(base_dir):
        # Skip node_modules or .git to be fast
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '.gemini', 'AppData']]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in extensions:
                full_path = os.path.join(root, file)
                try:
                    # Quick size check: skip huge files
                    if os.path.getsize(full_path) > 2 * 1024 * 1024:
                        continue
                    with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read().lower()
                        # Count matching keywords
                        matches = [kw for kw in keywords if kw in content]
                        if "trendline" in content or ("short" in content and "long" in content and "position" in content):
                            found_files.append((full_path, matches))
                except Exception:
                    pass

if found_files:
    print(f"Found {len(found_files)} matching file(s):\n")
    for path, matches in found_files:
        print(f"📍 {path}")
        print(f"   Matched keywords: {', '.join(matches)}\n")
else:
    print("No matching files found in Desktop or Downloads.")
    print("\nListing all .html / .js files in Desktop:")
    desktop = r"c:\Users\ILYAAS ABDIRAHMAN\Desktop"
    for item in os.listdir(desktop):
        full = os.path.join(desktop, item)
        if os.path.isdir(full):
            print(f"  [Folder] {item}")
        elif item.endswith(('.html', '.js')):
            print(f"  [File]   {item}")
