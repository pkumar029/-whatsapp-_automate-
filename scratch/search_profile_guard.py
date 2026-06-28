import os

search_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src"
term = "isProfileConfigured"

for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith((".jsx", ".js")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for idx, line in enumerate(f, 1):
                        if term in line:
                            print(f"{path}:{idx}: {line.strip()}")
            except Exception as e:
                pass
