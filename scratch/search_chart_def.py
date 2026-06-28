with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Dashboard/Dashboard.jsx", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "AnalyticsChart" in line:
            print(f"{idx}: {line.strip()}")
