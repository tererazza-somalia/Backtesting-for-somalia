with open(r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index.html", "r", encoding="utf-8") as f:
    text = f.read()

# Truncate cleanly at </html>
tag = "</html>"
idx = text.find(tag)
if idx != -1:
    clean_html = text[:idx + len(tag)] + "\n"
    with open(r"c:\Users\ILYAAS ABDIRAHMAN\Desktop\backtesting\index.html", "w", encoding="utf-8") as f:
        f.write(clean_html)
    print(f"Cleaned! Exactly {len(clean_html.splitlines())} lines. Perfectly closed with </html>.")
else:
    print("Could not find </html> tag.")
