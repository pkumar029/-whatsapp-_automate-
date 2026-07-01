import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
dir_path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/routes"
for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if "get_current_user" in content or "current_user" in content or "OAuth2PasswordBearer" in content:
                    print(f"Found JWT auth dependency in {path}")
            except Exception:
                pass
