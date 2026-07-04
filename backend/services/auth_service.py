"""
Auth Service — JWT token management and password hashing.
"""
import logging
import bcrypt as _bcrypt_lib
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from config.settings import settings

logger = logging.getLogger(__name__)


def hash_password(plain: str) -> str:
    return _bcrypt_lib.hashpw(plain.encode("utf-8"), _bcrypt_lib.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt_lib.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


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
