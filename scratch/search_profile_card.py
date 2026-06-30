import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Profile/Profile.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    found_idx = -1
    for idx, line in enumerate(lines):
        if "Role not set" in line or "profile.avatar" in line or "Role / Job Title" in line:
            print(f"{idx+1}: {line.strip()}")
except Exception as e:
    print(f"Error: {e}")
