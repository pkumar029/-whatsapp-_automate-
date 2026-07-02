path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/routes/auth.py"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "token" in l.lower() or "auto" in l.lower():
            clean_line = l.strip().encode('ascii', 'ignore').decode('ascii')
            print(f"{idx+1}: {clean_line}")
except Exception as e:
    print(f"Error: {e}")
