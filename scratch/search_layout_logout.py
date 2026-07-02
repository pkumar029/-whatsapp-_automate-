import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/components/Layout/Layout.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if "logout" in content.lower():
        print("Found logout in Layout.jsx!")
        for idx, line in enumerate(content.splitlines()):
            if "logout" in line.lower():
                print(f"{idx+1}: {line.strip()}")
    else:
        print("No logout found in Layout.jsx.")
except Exception as e:
    print(f"Error: {e}")
