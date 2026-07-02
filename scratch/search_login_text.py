path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Login/Login.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    print("File length:", len(content))
except Exception as e:
    print(f"Error: {e}")
