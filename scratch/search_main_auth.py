path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/main.py"
try:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if "middleware" in content or "auth" in content:
        print(content)
    else:
        print("No middleware or auth references in main.py")
except Exception as e:
    print(f"Error: {e}")
