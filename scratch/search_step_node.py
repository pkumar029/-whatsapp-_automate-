import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Automations/Automations.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    # Print lines 180 to 245
    for i in range(179, 245):
        print(f"{i+1}: {lines[i].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
