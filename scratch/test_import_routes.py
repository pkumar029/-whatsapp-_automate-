import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app

def print_routes(routes, prefix=""):
    for route in routes:
        if "IncludedRouter" in str(type(route)):
            print_routes(route.original_router.routes, prefix + getattr(route.include_context, "prefix", ""))
        else:
            path = getattr(route, "path", "")
            name = getattr(route, "name", "")
            endpoint = getattr(route, "endpoint", None)
            print(f"Path: {prefix}{path} | Name: {name} | Endpoint: {endpoint}")

print_routes(app.routes)
