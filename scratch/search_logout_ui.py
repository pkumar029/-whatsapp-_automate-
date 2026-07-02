import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
dir_path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src"
for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith(('.js', '.jsx')):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if "logout" in content.lower():
                    # Print lines with logout
                    for idx, line in enumerate(content.splitlines()):
                        if "logout" in line.lower() and ("button" in line.lower() or "click" in line.lower() or "const" in line.lower() or "function" in line.lower()):
                            print(f"{path}:{idx+1}: {line.strip()}")
            except Exception:
                pass
