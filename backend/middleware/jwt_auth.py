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
        path = request.url.path

        # Allow public paths through without a token
        if path in _PUBLIC_EXACT or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
            return await call_next(request)

        # OPTIONS pre-flight — let CORS middleware handle it
        if request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                {"detail": "Not authenticated"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth_header[7:]
        try:
            from services.auth_service import decode_token
            payload = decode_token(token)
        except ValueError:
            return JSONResponse(
                {"detail": "Invalid or expired token"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )

        request.state.user_id = int(payload["sub"])
        request.state.user_email = payload.get("email", "")
        request.state.user_name = payload.get("name", "")

        return await call_next(request)
