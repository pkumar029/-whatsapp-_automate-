with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Automations/Automations.jsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "handleSave" in line or "save" in line.lower() or "submit" in line.lower():
            if idx > 480 and idx < 580:
                print(f"{idx}: {line.strip()}")
