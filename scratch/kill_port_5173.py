import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

try:
    output = subprocess.check_output("netstat -ano", shell=True).decode('utf-8', errors='ignore')
    pids = set()
    for line in output.splitlines():
        if ":5173" in line:
            parts = line.strip().split()
            if len(parts) >= 5:
                pid = parts[-1]
                if pid.isdigit() and pid != "0":
                    pids.add(int(pid))
                    
    if not pids:
        print("No processes found using port 5173.")
    for pid in pids:
        print(f"Killing process with PID {pid} using port 5173...")
        subprocess.call(f"taskkill /F /PID {pid}", shell=True)
except Exception as e:
    print(f"Error: {e}")
