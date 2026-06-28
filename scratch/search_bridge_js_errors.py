import os

bridge_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/whatsapp-bridge"
matches = []

for root, dirs, files in os.walk(bridge_dir):
    for file in files:
        if file.endswith(".js") or file.endswith(".json"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line_no, line in enumerate(f, 1):
                        if "bridge error" in line.lower():
                            matches.append(f"{path}:{line_no}: {line.strip()}")
            except Exception:
                pass

for m in matches:
    print(m)
