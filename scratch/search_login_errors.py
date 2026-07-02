path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Login/Login.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "seterrormsg" in l.lower():
            # Clean non-ascii characters for terminal printing
            clean_line = l.strip().encode('ascii', 'ignore').decode('ascii')
            print(f"{idx+1}: {clean_line}")
except Exception as e:
    print(f"Error: {e}")
