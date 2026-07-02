"""
JWT Auth Middleware — validates Bearer tokens on every request except public paths.
Injects user_id / user_email / user_name into request.state on success.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from services.auth_service import decode_token

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
    "/api/v1/whatsapp/events",            # SSE — EventSource can't send headers
    "/api/v1/whatsapp/webhook",           # Bridge calls this internally
    "/api/v1/contacts/sync-progress",     # SSE — EventSource can't send headers
    "/api/v1/messages/stream",            # SSE — EventSource can't send headers
    "/",
}


def _is_public(path: str) -> bool:
    if path in _PUBLIC_EXACT:
        return True
    return any(path.startswith(prefix) for prefix in _PUBLIC_PREFIXES)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if _is_public(request.url.path):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        try:
            payload = decode_token(auth_header[len("Bearer "):])
        except ValueError:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        request.state.user_id = int(payload["sub"])
        request.state.user_email = payload.get("email")
        request.state.user_name = payload.get("name")
        return await call_next(request)
