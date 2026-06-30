import os

backend_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend"
matches = []

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(".py") and "venv" not in root:
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line_no, line in enumerate(f, 1):
                        if "7002" in line or "3000" in line:
                            matches.append(f"{path}:{line_no}: {line.strip()}")
            except Exception:
                pass

for m in matches:
    print(m)
