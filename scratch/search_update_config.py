with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Automations/Automations.jsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "updateConfigField" in line:
            print(f"{idx}: {line.strip()}")
