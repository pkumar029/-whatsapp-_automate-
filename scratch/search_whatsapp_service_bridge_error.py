with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/services/whatsapp_service.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "bridge error" in line.lower():
            print(f"{idx}: {line.strip()}")
