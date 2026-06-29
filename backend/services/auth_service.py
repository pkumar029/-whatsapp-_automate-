"""
Auth Service — Phone number + OTP login for the web app
"""
import random
import time
import logging
import httpx
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── In-memory stores (single-process; survive restarts only if stored in DB) ──
_otp_store: dict = {}     # phone → {otp, expires_at, attempts}
_session_store: dict = {}  # token → {phone, expires_at}

OTP_EXPIRY = 300       # 5 minutes
SESSION_EXPIRY = 86400  # 24 hours
MAX_ATTEMPTS = 5

# ── OTP ───────────────────────────────────────────────────────────────────────

def request_otp(phone: str) -> str:
    """Generate a 6-digit OTP for the given phone, store it and return it."""
    otp = str(random.randint(100000, 999999))
    _otp_store[phone] = {
        "otp": otp,
        "expires_at": time.time() + OTP_EXPIRY,
        "attempts": 0,
    }
    logger.info(f"OTP generated for {phone}: {otp}")
    return otp


def verify_otp(phone: str, otp: str) -> Optional[str]:
    """Verify OTP. Returns a session token on success, None on failure."""
    entry = _otp_store.get(phone)
    if not entry:
        return None
    if time.time() > entry["expires_at"]:
        _otp_store.pop(phone, None)
        return None
    entry["attempts"] += 1
    if entry["attempts"] > MAX_ATTEMPTS:
        _otp_store.pop(phone, None)
        return None
    if entry["otp"] != str(otp).strip():
        return None

    _otp_store.pop(phone, None)

    import secrets
    token = secrets.token_hex(24)
    _session_store[token] = {
        "phone": phone,
        "expires_at": time.time() + SESSION_EXPIRY,
    }
    return token


def validate_token(token: str) -> Optional[str]:
    """Return phone if token is valid, else None."""
    if not token:
        return None
    entry = _session_store.get(token)
    if not entry:
        return None
    if time.time() > entry["expires_at"]:
        _session_store.pop(token, None)
        return None
    return entry["phone"]


def logout_token(token: str) -> None:
    _session_store.pop(token, None)


# ── Allowed phones ─────────────────────────────────────────────────────────────

def get_allowed_phones(db: Session) -> list[str]:
    """Return the list of phone numbers allowed to log in (empty = any phone)."""
    from models.models import SystemSettings
    row = db.query(SystemSettings).filter(SystemSettings.key == "auth_allowed_phones").first()
    if not row or not row.value:
        return []
    return [p.strip() for p in row.value.split(",") if p.strip()]


def is_phone_allowed(phone: str, db: Session) -> bool:
    allowed = get_allowed_phones(db)
    if not allowed:
        return True  # open mode — any phone can log in
    clean = phone.replace(" ", "").replace("-", "")
    return any(clean.endswith(a.replace(" ", "").replace("-", "")) for a in allowed)


# ── SMS sending ────────────────────────────────────────────────────────────────

def send_otp_sms(phone: str, otp: str, db: Session) -> dict:
    """Send OTP via configured SMS gateway.

    Supported config keys in system_settings:
      sms_provider   — 'fast2sms' | 'twilio' | 'custom' | '' (console only)
      sms_api_key    — API key / auth token
      sms_from       — Sender ID / Twilio from-number
      sms_custom_url — Custom GET URL with {phone} and {otp} placeholders
    """
    from models.models import SystemSettings
    rows = db.query(SystemSettings).filter(
        SystemSettings.key.in_(["sms_provider", "sms_api_key", "sms_from", "sms_custom_url"])
    ).all()
    cfg = {r.key: r.value for r in rows}

    provider = (cfg.get("sms_provider") or "").strip().lower()
    api_key = (cfg.get("sms_api_key") or "").strip()
    sender = (cfg.get("sms_from") or "WTAUTO").strip()
    custom_url = (cfg.get("sms_custom_url") or "").strip()

    digits = "".join(filter(str.isdigit, phone))

    try:
        if provider == "fast2sms" and api_key:
            r = httpx.get(
                "https://www.fast2sms.com/dev/bulkV2",
                params={
                    "authorization": api_key,
                    "route": "otp",
                    "numbers": digits,
                    "variables_values": otp,
                    "flash": "0",
                },
                timeout=10,
            )
            data = r.json()
            if data.get("return"):
                return {"success": True, "message": "OTP sent via Fast2SMS"}
            return {"success": False, "message": data.get("message", "Fast2SMS error")}

        elif provider == "twilio" and api_key and sender:
            account_sid, auth_token = (api_key.split(":", 1) + [""])[:2]
            r = httpx.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
                auth=(account_sid, auth_token),
                data={
                    "From": sender,
                    "To": phone,
                    "Body": f"Your WhatsApp Automate login OTP is: {otp}. Valid for 5 minutes.",
                },
                timeout=10,
            )
            if r.status_code in (200, 201):
                return {"success": True, "message": "OTP sent via Twilio"}
            return {"success": False, "message": f"Twilio error {r.status_code}"}

        elif provider == "custom" and custom_url:
            url = custom_url.replace("{phone}", digits).replace("{otp}", otp)
            r = httpx.get(url, timeout=10)
            if r.status_code == 200:
                return {"success": True, "message": "OTP sent via custom gateway"}
            return {"success": False, "message": f"Custom SMS error {r.status_code}"}

        else:
            # No SMS provider configured — OTP is visible in server logs only
            logger.warning(f"No SMS provider configured. OTP for {phone}: {otp}")
            return {
                "success": True,
                "message": "OTP logged to server console (configure SMS gateway in Settings → Security)",
                "dev_otp": otp,   # only returned when no provider is set
            }

    except Exception as e:
        logger.error(f"SMS send failed: {e}")
        return {"success": False, "message": f"SMS error: {str(e)}"}
