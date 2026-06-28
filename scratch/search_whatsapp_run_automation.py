with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/routes/whatsapp.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "run_automation" in line:
            print(f"{idx}: {line.strip()}")
