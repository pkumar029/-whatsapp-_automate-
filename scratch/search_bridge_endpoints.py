with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/whatsapp-bridge/index.js", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "app.post" in line or "/send" in line:
            print(f"{idx}: {line.strip()}")
