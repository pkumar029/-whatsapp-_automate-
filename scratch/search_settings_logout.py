path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Settings/Settings.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "logout" in l.lower():
            for j in range(max(0, idx - 5), min(len(lines), idx + 10)):
                print(f"{j+1}: {lines[j].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
