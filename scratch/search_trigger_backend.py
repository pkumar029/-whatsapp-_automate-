import os

backend_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend"

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "trigger_config" in content or "cron" in content:
                        print(f"Found in {path}")
            except Exception:
                pass
