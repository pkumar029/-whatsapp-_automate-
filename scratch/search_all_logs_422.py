import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
log_dir = "C:/Users/ELCOT/.gemini/antigravity/brain/19eda1e0-a4a1-4a73-a80a-ee5c583360fc/.system_generated/tasks"
try:
    for file in os.listdir(log_dir):
        if file.endswith(".log"):
            path = os.path.join(log_dir, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                for line_no, line in enumerate(f, 1):
                    if "422" in line or "unprocessable" in line.lower():
                        print(f"{file}:{line_no}: {line.strip()}")
except Exception as e:
    print(f"Error: {e}")
