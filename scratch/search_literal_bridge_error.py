import os

backend_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend"

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(".py") and "venv" not in root:
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "Bridge error:" in content:
                        print(f"Match: {path}")
            except Exception:
                pass
