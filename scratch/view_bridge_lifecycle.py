path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/whatsapp-bridge/index.js"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "app.post('/connect'" in l or "app.post('/disconnect'" in l or "async function initClient" in l or "function initClient" in l:
            for j in range(max(0, idx - 5), min(len(lines), idx + 45)):
                print(f"{j+1}: {lines[j].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
