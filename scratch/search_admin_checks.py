import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

search_dirs = [
    "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend",
    "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src"
]
matches = []

for s_dir in search_dirs:
    for root, dirs, files in os.walk(s_dir):
        if "node_modules" in root or "venv" in root:
            continue
        for file in files:
            if file.endswith((".py", ".jsx", ".js")):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        for line_no, line in enumerate(f, 1):
                            if "admin" in line.lower() or "role" in line.lower():
                                matches.append(f"{path}:{line_no}: {line.strip()}")
                except Exception:
                    pass

for m in matches[:100]:
    print(m)
