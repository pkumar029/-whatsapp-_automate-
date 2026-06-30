log_path = r"C:\Users\ELCOT\.gemini\antigravity\brain\19eda1e0-a4a1-4a73-a80a-ee5c583360fc\.system_generated\tasks\task-3742.log"

try:
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        
    print(f"Total log lines: {len(lines)}")
    # Find any line containing "405" or "Method Not Allowed"
    found = []
    for idx, line in enumerate(lines):
        if "405" in line or "Method Not Allowed" in line:
            found.append((idx + 1, line.strip()))
            
    print(f"Found {len(found)} matching lines:")
    for line_no, content in found[-10:]: # last 10
        print(f"Line {line_no}: {content}")
except Exception as e:
    print(f"Error reading log: {e}")
