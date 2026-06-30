import os

frontend_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend"
matches = []

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(".css") and "node_modules" not in root:
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line_no, line in enumerate(f, 1):
                        if "modal" in line:
                            matches.append(f"{path}:{line_no}: {line.strip()}")
            except Exception:
                pass

for m in matches:
    print(m)
