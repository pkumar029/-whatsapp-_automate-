"""
Auth Service — JWT token management for device-bound authentication.

There's no password anymore (see routes/auth.py's /device endpoint) — a
device silently gets an account and a long-lived token stands in for a
login session for as long as that browser holds onto it.
"""
import logging
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from config.settings import settings

logger = logging.getLogger(__name__)


def create_access_token(user_id: int, email: str, name: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "exp": expires,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises ValueError on failure."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except JWTError as e:
        raise ValueError(str(e))


def user_id_from_token(token: str):
    """Decode a JWT and return its subject user id, or None if invalid/expired.

    Used by the public SSE endpoints (EventSource can't send an Authorization
    header) to verify the caller-supplied user_id actually matches a valid
    token for that user — without this, any client could pass an arbitrary
    user_id and read another user's live message/WhatsApp/contact-sync events.
    """
    try:
        payload = decode_token(token)
        return int(payload["sub"])
    except Exception:
        return None
