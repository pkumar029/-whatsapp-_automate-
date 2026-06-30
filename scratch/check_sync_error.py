import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_path = "C:/Users/ELCOT/.gemini/antigravity/brain/19eda1e0-a4a1-4a73-a80a-ee5c583360fc/.system_generated/tasks/task-4093.log"
with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

print(f"Total lines in current log: {len(lines)}")
print("Searching for 500 Internal Server Error tracebacks...")
for idx, line in enumerate(lines):
    if "500 Internal Server Error" in line or "Traceback" in line or "/sync" in line:
        start = max(0, idx - 5)
        end = min(len(lines), idx + 25)
        print(f"\n--- MATCH AT LINE {idx+1} ---")
        for i in range(start, end):
            print(f"{i+1}: {lines[i].rstrip()}")
