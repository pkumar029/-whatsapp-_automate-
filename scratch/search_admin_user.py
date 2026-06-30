import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

frontend_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src"
matches = []

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith((".jsx", ".js")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line_no, line in enumerate(f, 1):
                        if "Admin User" in line:
                            matches.append(f"{path}:{line_no}: {line.strip()}")
            except Exception:
                pass

for m in matches:
    print(m)
