import sys

sys.stdout.reconfigure(encoding='utf-8')
path = "C:/Users/ELCOT/.gemini/antigravity/brain/19eda1e0-a4a1-4a73-a80a-ee5c583360fc/.system_generated/tasks/task-4932.log"
try:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    count = 0
    for idx, l in enumerate(lines):
        if "GET" in l or "POST" in l or "127.0.0.1" in l:
            clean_line = l.strip().encode('ascii', 'ignore').decode('ascii')
            print(clean_line)
            count += 1
            if count > 50:
                print("Showing first 50 lines only.")
                break
    if count == 0:
        print("No HTTP requests found in the backend log.")
except Exception as e:
    print(f"Error: {e}")
