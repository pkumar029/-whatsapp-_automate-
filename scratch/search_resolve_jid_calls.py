path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/whatsapp-bridge/index.js"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "resolvejid" in l.lower():
            print(f"{idx+1}: {l.strip()}")
except Exception as e:
    print(f"Error: {e}")
