with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/routes/whatsapp.py", "r", encoding="utf-8") as f:
    lines = f.readlines()
    
for idx, line in enumerate(lines, 1):
    if "run_automation" in line or "context" in line:
        if idx > 100 and idx < 170:
            print(f"{idx}: {line.strip()}")
