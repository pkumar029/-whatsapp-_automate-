"""
Utils — Logging setup, helper functions
"""
import logging
import os
from config.settings import settings


def setup_logging():
    """Configure application logging."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # Ensure logs directory exists
    log_dir = os.path.dirname(settings.LOG_FILE)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(settings.LOG_FILE, encoding="utf-8"),
        ],
    )
    logger = logging.getLogger(__name__)
    logger.info(f"Logging initialized at level {settings.LOG_LEVEL}")


def format_phone(phone: str) -> str:
    """Normalize phone number format."""
    import re
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    if not cleaned.startswith('+'):
        cleaned = '+' + cleaned
    return cleaned


def paginate(query, page: int, limit: int):
    """Apply pagination to a SQLAlchemy query."""
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total
