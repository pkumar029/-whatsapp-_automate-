import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
try:
    output = subprocess.check_output("netstat -ano", shell=True).decode('utf-8', errors='ignore')
    found = False
    for line in output.splitlines():
        if ":7001" in line:
            print(line.strip())
            found = True
    if not found:
        print("No processes bound to port 7001.")
except Exception as e:
    print(f"Error: {e}")
