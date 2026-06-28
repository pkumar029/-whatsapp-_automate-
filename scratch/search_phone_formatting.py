with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/services/whatsapp_service.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "phone" in line.lower() or "format" in line.lower() or "replace" in line.lower():
            if idx > 150 and idx < 280:
                print(f"{idx}: {line.strip()}")
