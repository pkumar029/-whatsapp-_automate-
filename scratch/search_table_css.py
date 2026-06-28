with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/styles/index.css", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if line.strip().startswith(".table-container {"):
            print(f"Table container defined at line {idx}: {line.strip()}")
