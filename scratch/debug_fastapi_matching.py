import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app
from starlette.routing import Match

scope = {
    "type": "http",
    "method": "POST",
    "path": "/api/v1/messages/sync",
    "headers": []
}

print("Tracing route matching for POST /api/v1/messages/sync:")
for route in app.routes:
    match, child_scope = route.matches(scope)
    if match != Match.NONE:
        print(f"Matched route: {getattr(route, 'path', None)} | Match Type: {match} | Name: {getattr(route, 'name', None)}")
        # If it's a Mount/Router, let's trace inside it
        if hasattr(route, "app") and hasattr(route.app, "routes"):
            print("  Tracing inside mounted app:")
            sub_scope = {**scope, "path": scope["path"].replace("/api/v1", "")}
            for sub_route in route.app.routes:
                sub_match, sub_child = sub_route.matches(sub_scope)
                if sub_match != Match.NONE:
                    print(f"    Sub-route: {sub_route.path} | Match Type: {sub_match} | Name: {sub_route.name} | Methods: {list(getattr(sub_route, 'methods', []))}")
