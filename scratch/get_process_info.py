import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
try:
    output = subprocess.check_output('tasklist /FI "PID eq 16280"', shell=True).decode('utf-8', errors='ignore')
    print(output)
except Exception as e:
    print(f"Error: {e}")
