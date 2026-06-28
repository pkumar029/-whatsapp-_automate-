with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Settings/Settings.jsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "connection_type" in line or "dev" in line.lower() or "bridge" in line.lower():
            if "device" not in line.lower() or "connection_type" in line:
                print(f"{idx}: {line.strip()}")
