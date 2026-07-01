path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Messages/Messages.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "time" in l.lower() or "date" in l.lower() or "format" in l.lower():
            print(f"{idx+1}: {l.strip()}")
except Exception as e:
    print(f"Error: {e}")
