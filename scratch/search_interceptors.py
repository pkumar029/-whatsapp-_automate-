import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
dir_path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend"
for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.js') or file.endswith('.jsx'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if "interceptor" in content.lower():
                    print(f"Found interceptor in: {path}")
            except Exception:
                pass
