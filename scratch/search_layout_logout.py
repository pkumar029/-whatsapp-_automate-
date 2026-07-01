path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/components/Layout/Layout.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if "logout" in content.lower():
        print("Found logout reference in Layout.jsx")
    else:
        print("No logout reference in Layout.jsx")
except Exception as e:
    print(f"Error: {e}")
