with open("C:/Users/ELCOT/.gemini/antigravity/brain/19eda1e0-a4a1-4a73-a80a-ee5c583360fc/.system_generated/tasks/task-2948.log", "r", encoding="utf-8") as f:
    lines = f.readlines()
    
# Find the last 200 lines and look for ERROR or 502 or exception trace
tail_lines = lines[-200:]
for line in tail_lines:
    if "ERROR" in line or "502" in line or "exception" in line.lower() or "chats" in line.lower():
        print(line.strip())
