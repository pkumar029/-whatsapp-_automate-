with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/routes/contacts.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "def" in line or "chats" in line.lower():
            print(f"{idx}: {line.strip()}")
