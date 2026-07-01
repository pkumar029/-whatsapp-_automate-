import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
project_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate"
matches = []

for root, dirs, files in os.walk(project_dir):
    if "node_modules" in root or "venv" in root or ".git" in root:
        continue
    for file in files:
        if file.endswith((".py", ".jsx", ".js", ".json", ".md")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line_no, line in enumerate(f, 1):
                        if "ticket" in line.lower():
                            matches.append(f"{path}:{line_no}: {line.strip()}")
            except Exception:
                pass

for m in matches[:100]:
    print(m)
