import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Messages/Messages.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    for idx, line in enumerate(lines):
        if "contactsApi.getAll" in line:
            # Print 10 lines before and after
            start = max(0, idx - 10)
            end = min(len(lines), idx + 10)
            print(f"--- Matches around line {idx+1} ---")
            for i in range(start, end):
                print(f"{i+1}: {lines[i].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
