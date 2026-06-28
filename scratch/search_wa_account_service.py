with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/services/contacts_service.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "wa_account" in line:
            print(f"{idx}: {line.strip()}")
