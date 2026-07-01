import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')
pids = [16280, 21696]
for pid in pids:
    print(f"Terminating PID {pid}...")
    subprocess.call(f"taskkill /F /PID {pid}", shell=True)
