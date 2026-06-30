import os

log_path = "C:/Users/ELCOT/.gemini/antigravity/brain/19eda1e0-a4a1-4a73-a80a-ee5c583360fc/.system_generated/tasks/task-4093.log"
with open(log_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
print("Last 30 lines of backend log:")
for l in lines[-30:]:
    print(l.strip())

print("\nLines matching 422 or contacts:")
for idx, l in enumerate(lines):
    if "422" in l or "/contacts" in l:
        print(f"{idx+1}: {l.strip()}")
