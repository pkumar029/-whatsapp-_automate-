path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/context/AuthContext.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        print(f.read())
except Exception as e:
    print(f"Error: {e}")
