with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/services/contacts_service.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "chat" in line.lower():
            print(f"{idx}: {line.strip()}")
