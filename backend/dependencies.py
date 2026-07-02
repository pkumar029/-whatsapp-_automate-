"""Shared FastAPI dependencies."""
from fastapi import Request


def current_user_id(request: Request) -> int:
    """The authenticated user's id, set by JWTAuthMiddleware.dispatch()."""
    return request.state.user_id
