with open("C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/styles/index.css", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if line.strip().startswith(".card {"):
            print(f"Card defined at line {idx}: {line.strip()}")
        if line.strip().startswith(".card-header {"):
            print(f"Card header defined at line {idx}: {line.strip()}")
