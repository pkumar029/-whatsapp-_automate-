import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
curr = "C:/Users/ELCOT/Desktop/Django"
while True:
    if os.path.exists(os.path.join(curr, ".git")):
        print(f"Git root found at: {curr}")
        break
    parent = os.path.dirname(curr)
    if parent == curr:
        print("No .git found in parent directories.")
        break
    curr = parent
