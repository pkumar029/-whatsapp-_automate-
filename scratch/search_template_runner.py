with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/services/automation_runner.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "message" in line.lower() or "template" in line.lower():
            print(f"{idx}: {line.strip()}")
