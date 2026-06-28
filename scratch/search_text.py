import os

search_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src"
terms = ["Automation Platform", "WA Automate"]

for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith((".jsx", ".js", ".html", ".css")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    for term in terms:
                        if term in content:
                            print(f"Found '{term}' in {path}")
            except Exception as e:
                pass
