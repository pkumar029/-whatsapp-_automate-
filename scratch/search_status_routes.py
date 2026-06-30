with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/routes/contacts.py", "r", encoding="utf-8") as f:
    for line_no, line in enumerate(f, 1):
        if "status" in line:
            print(f"{line_no}: {line.strip()}")
