path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/services/whatsapp_service.py"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "def disconnect_whatsapp" in l:
            for j in range(max(0, idx - 10), min(len(lines), idx + 30)):
                print(f"{j+1}: {lines[j].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
