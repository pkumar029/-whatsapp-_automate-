path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/routes/messages.py"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "datetime" in l or "sent_at" in l or "created_at" in l:
            for j in range(max(0, idx - 2), min(len(lines), idx + 8)):
                print(f"{j+1}: {lines[j].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
