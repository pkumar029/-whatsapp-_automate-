import os

path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Automations/Automations.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    # Find line containing "Workflow Steps"
    found_idx = -1
    for idx, line in enumerate(lines):
        if "Workflow Steps" in line:
            found_idx = idx
            break
            
    if found_idx != -1:
        # Print 80 lines starting from found_idx
        for i in range(found_idx, min(found_idx + 80, len(lines))):
            print(f"{i+1}: {lines[i].strip()}")
except Exception as e:
    print(f"Error: {e}")
