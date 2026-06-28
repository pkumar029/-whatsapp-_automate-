with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/whatsapp-bridge/index.js", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "send" in line.lower() or "phone" in line.lower():
            if idx > 100 and idx < 200:
                print(f"{idx}: {line.strip()}")
