path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/services/automation_runner.py"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "react" in l.lower():
            for j in range(max(0, idx - 5), min(len(lines), idx + 25)):
                print(f"{j+1}: {lines[j].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
