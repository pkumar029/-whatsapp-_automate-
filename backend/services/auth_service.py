"""
Auth Service — JWT token management and password hashing.
"""
import logging
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from config.settings import settings

logger = logging.getLogger(__name__)

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


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


def ensure_admin_user(db) -> None:
    """Create a default admin user on first run if the users table is empty."""
    from models.models import User
    try:
        if db.query(User).count() == 0:
            admin = User(
                name="Admin",
                email="admin@localhost",
                password_hash=hash_password("admin123"),
                is_admin=True,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            logger.info("Default admin user created → email: admin@localhost  password: admin123")
    except Exception as e:
        logger.warning(f"Could not seed admin user: {e}")
