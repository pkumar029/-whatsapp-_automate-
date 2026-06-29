"""
Profile Service — fetch and upsert the connected WhatsApp account's own profile.
"""
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models.models import WhatsAppProfile

logger = logging.getLogger(__name__)


def upsert_whatsapp_profile(
    db: Session,
    wa_account: str,
    name: Optional[str] = None,
    profile_pic_url: Optional[str] = None,
    about: Optional[str] = None,
    wid: Optional[str] = None,
) -> WhatsAppProfile:
    """Insert or update a WhatsApp profile keyed by wa_account (phone number)."""
    profile = db.query(WhatsAppProfile).filter(WhatsAppProfile.wa_account == wa_account).first()
    if profile:
        if name is not None:
            profile.display_name = name
        if profile_pic_url is not None:
            profile.profile_pic_url = profile_pic_url
        if about is not None:
            profile.about = about
        if wid is not None:
            profile.wid = wid
        profile.last_synced_at = datetime.utcnow()
    else:
        profile = WhatsAppProfile(
            wa_account=wa_account,
            display_name=name,
            profile_pic_url=profile_pic_url,
            about=about,
            wid=wid,
            last_synced_at=datetime.utcnow(),
        )
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def get_whatsapp_profile(db: Session, wa_account: str) -> Optional[WhatsAppProfile]:
    return db.query(WhatsAppProfile).filter(WhatsAppProfile.wa_account == wa_account).first()


def fetch_and_save_profile(db: Session, wa_account: str) -> dict:
    """
    Call the bridge /my-profile, upsert in DB, and return the profile dict.
    Falls back to the stored DB record if the bridge is unreachable.
    """
    import httpx
    bridge_data = None
    try:
        r = httpx.get("http://localhost:7002/my-profile", timeout=10.0)
        if r.status_code == 200:
            bridge_data = r.json()
    except Exception as e:
        logger.warning(f"fetch_and_save_profile: bridge unreachable — {e}")

    if bridge_data and bridge_data.get("success"):
        profile = upsert_whatsapp_profile(
            db,
            wa_account=wa_account,
            name=bridge_data.get("name"),
            profile_pic_url=bridge_data.get("profile_pic"),
            about=bridge_data.get("about"),
            wid=bridge_data.get("wid"),
        )
    else:
        profile = get_whatsapp_profile(db, wa_account)

    if not profile:
        return {
            "success": True,
            "wa_account": wa_account,
            "name": None,
            "phone": wa_account,
            "profile_pic_url": None,
            "about": None,
            "wid": None,
        }

    return {
        "success": True,
        "wa_account": profile.wa_account,
        "name": profile.display_name,
        "phone": profile.wa_account,
        "profile_pic_url": profile.profile_pic_url,
        "about": profile.about,
        "wid": profile.wid,
        "last_synced_at": profile.last_synced_at,
    }
