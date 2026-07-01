import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = "C:/Users/ELCOT/.gemini/antigravity/brain/19eda1e0-a4a1-4a73-a80a-ee5c583360fc/.system_generated/tasks/task-4384.log"
with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

lines = content.splitlines()
print(f"Total log lines: {len(lines)}")
for idx, l in enumerate(lines[:150]):
    if "running on" in l.lower() or "started" in l.lower() or "error" in l.lower() or "address" in l.lower() or "port" in l.lower():
        print(f"{idx+1}: {l}")
