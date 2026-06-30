import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app

for r in app.routes:
    if r.__class__.__name__ == "_IncludedRouter":
        print("Fields of _IncludedRouter:")
        print(dir(r))
        # Print its router or sub-routes
        if hasattr(r, "router"):
            print("Router routes:")
            for sr in r.router.routes:
                print(f"  Path: {sr.path} | Methods: {list(sr.methods) if getattr(sr, 'methods', None) else None} | Name: {sr.name}")
        break
