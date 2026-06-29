"""
Auth Routes — Phone number + OTP login
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.connection import get_db
from services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str


@router.post("/request-otp")
async def request_otp(data: OTPRequest, db: Session = Depends(get_db)):
    """Generate an OTP and send it to the given phone number via SMS."""
    phone = data.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    if not auth_service.is_phone_allowed(phone, db):
        raise HTTPException(status_code=403, detail="This phone number is not authorised to log in")

    otp = auth_service.request_otp(phone)
    result = auth_service.send_otp_sms(phone, otp, db)
    return result


@router.post("/verify-otp")
async def verify_otp(data: OTPVerify):
    """Verify the OTP and return a session token."""
    token = auth_service.verify_otp(data.phone.strip(), data.otp.strip())
    if not token:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP. Please try again.")
    return {"success": True, "token": token}


@router.get("/me")
async def get_me(authorization: Optional[str] = Header(None)):
    """Return current logged-in user info based on Bearer token."""
    token = _extract_token(authorization)
    phone = auth_service.validate_token(token)
    if not phone:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"phone": phone}


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Invalidate the current session token."""
    token = _extract_token(authorization)
    if token:
        auth_service.logout_token(token)
    return {"success": True}


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


# ── SMS Settings ──────────────────────────────────────────────────────────────

class SMSSettings(BaseModel):
    sms_provider: str = ""      # fast2sms | twilio | custom | ""
    sms_api_key: str = ""
    sms_from: str = ""
    sms_custom_url: str = ""
    auth_allowed_phones: str = ""  # comma-separated list of allowed phones


@router.get("/sms-settings")
async def get_sms_settings(db: Session = Depends(get_db)):
    """Return current SMS / security settings."""
    from models.models import SystemSettings
    keys = ["sms_provider", "sms_api_key", "sms_from", "sms_custom_url", "auth_allowed_phones"]
    rows = db.query(SystemSettings).filter(SystemSettings.key.in_(keys)).all()
    cfg = {r.key: r.value or "" for r in rows}
    return {k: cfg.get(k, "") for k in keys}


@router.put("/sms-settings")
async def save_sms_settings(data: SMSSettings, db: Session = Depends(get_db)):
    """Save SMS / security settings."""
    from models.models import SystemSettings
    fields = data.dict()
    for key, value in fields.items():
        row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if row:
            row.value = value
        else:
            db.add(SystemSettings(key=key, value=value))
    db.commit()
    return {"success": True, "message": "Settings saved"}


@router.post("/test-sms")
async def test_sms(data: OTPRequest, db: Session = Depends(get_db)):
    """Send a test OTP to the given phone to verify SMS configuration."""
    otp = auth_service.request_otp(data.phone.strip())
    result = auth_service.send_otp_sms(data.phone.strip(), otp, db)
    return result
