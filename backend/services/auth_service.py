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


STREAM_TICKET_TTL_SECONDS = 60


def create_stream_ticket(user_id: int) -> str:
    """Mint a short-lived, single-purpose ticket for opening one SSE
    connection. EventSource can't send an Authorization header, so the main
    (365-day) JWT would otherwise have to go in the URL — which proxies,
    servers, and browsers all log/retain. A ticket that's dead within a
    minute and only ever usable for streaming is a much smaller thing to
    leak than the account's real, long-lived credential."""
    expires = datetime.now(timezone.utc) + timedelta(seconds=STREAM_TICKET_TTL_SECONDS)
    payload = {"sub": str(user_id), "scope": "stream", "exp": expires, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def user_id_from_stream_ticket(ticket: str):
    """Decode a stream ticket and return its subject user id, or None if
    invalid/expired/wrong scope. The SSE endpoints accept ONLY tickets from
    here — never the main JWT — so a leaked stream URL exposes at most a
    minute of read access to one stream, not the whole account."""
    try:
        payload = decode_token(ticket)
        if payload.get("scope") != "stream":
            return None
        return int(payload["sub"])
    except Exception:
        return None
