import os

project_dir = "C:/Users/ELCOT/Desktop/project/whatsapp-automate"
for f in os.listdir(project_dir):
    if f.endswith((".env", ".config.js", ".config.ts", ".json")) or f == "vite.config.js":
        print(f"Root file: {f}")

frontend_dir = os.path.join(project_dir, "frontend")
if os.path.exists(frontend_dir):
    for f in os.listdir(frontend_dir):
        if f.startswith(".env") or f == "vite.config.js":
            print(f"Frontend file: {f}")
