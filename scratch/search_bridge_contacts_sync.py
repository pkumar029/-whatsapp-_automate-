with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/whatsapp-bridge/index.js", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "getcontacts" in line.lower() or "getchats" in line.lower() or "sync" in line.lower():
            print(f"{idx}: {line.strip()}")
