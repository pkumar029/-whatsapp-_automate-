with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/models/models.py", "r", encoding="utf-8") as f:
    lines = f.readlines()
    
start_idx = -1
for idx, line in enumerate(lines):
    if "class Contact" in line:
        start_idx = idx
        break

if start_idx != -1:
    for i in range(start_idx, min(start_idx + 40, len(lines))):
        print(f"{i+1}: {lines[i].strip()}")
