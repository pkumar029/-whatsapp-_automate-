import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = "C:/Users/ELCOT/.gemini/antigravity/brain/19eda1e0-a4a1-4a73-a80a-ee5c583360fc/.system_generated/tasks/task-4384.log"
with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

print(f"Total lines in current log: {len(lines)}")
print("Uvicorn crash lines (last 50):")
for idx, l in enumerate(lines[-50:]):
    print(f"{len(lines)-50+idx+1}: {l.rstrip()}")
