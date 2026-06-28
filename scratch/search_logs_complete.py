with open("C:/Users/ELCOT/.gemini/antigravity/brain/19eda1e0-a4a1-4a73-a80a-ee5c583360fc/.system_generated/tasks/task-2948.log", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, 1):
        if "bridge error" in line.lower() or "contacts/chats" in line.lower():
            print(f"Line {idx}: {line.strip()}")
