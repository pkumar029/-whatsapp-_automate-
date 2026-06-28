with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Campaigns/Campaigns.jsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "delay" in line or "group" in line or "contacts" in line:
            print(f"{idx}: {line.strip()}")
