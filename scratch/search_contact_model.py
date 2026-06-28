with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/models/models.py", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "class Contact" in line or "group" in line.lower() or "type" in line.lower():
            if idx > 30 and idx < 100:
                print(f"{idx}: {line.strip()}")
