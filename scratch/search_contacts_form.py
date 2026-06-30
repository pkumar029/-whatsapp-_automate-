import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Contacts/Contacts.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    found_idx = -1
    for idx, line in enumerate(lines):
        if "handleSubmit" in line or "contactsApi.create" in line:
            found_idx = idx
            break
            
    if found_idx != -1:
        # Print 40 lines around found_idx
        start = max(0, found_idx - 15)
        end = min(len(lines), found_idx + 25)
        for i in range(start, end):
            print(f"{i+1}: {lines[i].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
