import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app

print("Registered FastAPI Routes:")
for route in app.routes:
    # Print route path and methods
    methods = getattr(route, "methods", None)
    path = getattr(route, "path", None)
    name = getattr(route, "name", None)
    print(f"Path: {path} | Methods: {list(methods) if methods else None} | Name: {name}")
