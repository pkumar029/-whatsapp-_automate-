import os

path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/frontend/src/pages/Automations/Automations.jsx"
try:
    with open(path, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            if "width" in line or "max-width" in line or "modal" in line or "style" in line:
                if len(line.strip()) < 120:
                    print(f"{line_no}: {line.strip()}")
except Exception as e:
    print(f"Error: {e}")
