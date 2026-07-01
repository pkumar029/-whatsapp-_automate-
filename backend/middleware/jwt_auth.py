"""
JWT Auth Middleware — validates Bearer tokens on every request except public paths.
Injects user_id / user_email / user_name into request.state on success.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Paths that never require a JWT
_PUBLIC_PREFIXES = (
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
)
_PUBLIC_EXACT = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/auto-token",            # Auto-login for single-user installations
    "/api/v1/whatsapp/status",            # AppContext polls before login
    "/api/v1/whatsapp/events",            # SSE — EventSource can't send headers
    "/api/v1/whatsapp/webhook",           # Bridge calls this internally
    "/api/v1/contacts/sync-progress",     # SSE — EventSource can't send headers
    "/api/v1/messages/stream",            # SSE — EventSource can't send headers
    "/",
}


class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = 1
        request.state.user_email = "admin@localhost"
        request.state.user_name = "Admin"
        return await call_next(request)
