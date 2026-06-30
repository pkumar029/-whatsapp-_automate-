import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from routes.messages import router

print("Direct Messages Router Routes:")
for r in router.routes:
    print(f"Path: {r.path} | Methods: {list(r.methods) if getattr(r, 'methods', None) else None} | Name: {r.name}")
