import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app

def print_route(route, prefix=""):
    class_name = route.__class__.__name__
    if class_name == "APIRoute":
        print(f"Path: {prefix}{route.path} | Methods: {list(route.methods)} | Name: {route.name}")
    elif class_name == "Mount":
        for sub_route in route.routes:
            print_route(sub_route, prefix + route.path)
    else:
        print(f"Other: {class_name} | Path: {getattr(route, 'path', None)}")

print("Registered FastAPI Routes:")
for r in app.routes:
    print_route(r)
