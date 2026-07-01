path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/whatsapp-bridge/index.js"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        if "client.on('message'" in l or "client.on(\"message\"" in l:
            print(f"Line {idx+1}: {l.strip()}")
            for j in range(max(0, idx - 2), min(len(lines), idx + 20)):
                print(f"  {j+1}: {lines[j].rstrip()}")
except Exception as e:
    print(f"Error: {e}")
