import os

backend_routes = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/routes"

for file in os.listdir(backend_routes):
    if file.endswith(".py"):
        path = os.path.join(backend_routes, file)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            if "httpx" in content:
                print(f"File: {path}")
                for idx, line in enumerate(content.splitlines(), 1):
                    if "httpx" in line or "async def" in line:
                        print(f"  {idx}: {line.strip()}")
