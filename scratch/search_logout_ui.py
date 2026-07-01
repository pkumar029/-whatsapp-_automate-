import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
dir_path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src"
for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith(('.js', '.jsx', '.html', '.css')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if "logout" in content.lower():
                    if "authcontext" not in path.lower():
                        print(f"Found logout in UI file: {path}")
            except Exception:
                pass
