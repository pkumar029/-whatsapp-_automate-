path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/App.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    print(content)
except Exception as e:
    print(f"Error: {e}")
