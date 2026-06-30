"""
WhatsApp Routes — Connect, disconnect, status, send message
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Optional, List
from sqlalchemy.orm import Session
from database.connection import get_db
from services import whatsapp_service
from models.schemas import WhatsAppSendRequest, WhatsAppStatusResponse, WhatsAppConnectResponse, WhatsAppConnectRequest

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.get("/status", response_model=WhatsAppStatusResponse)
async def get_status(db: Session = Depends(get_db)):
    """Get current WhatsApp session status."""
    return whatsapp_service.get_session_status(db)


@router.post("/connect", response_model=WhatsAppConnectResponse)
async def connect(data: WhatsAppConnectRequest, db: Session = Depends(get_db)):
    """Initiate WhatsApp connection with specific configuration."""
    try:
        return whatsapp_service.connect_whatsapp_with_config(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect")
async def disconnect(db: Session = Depends(get_db)):
    """Disconnect WhatsApp session."""
    try:
        return whatsapp_service.disconnect_whatsapp(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-session")
async def clear_session():
    """Wipe the bridge's saved WhatsApp session so the next connect requires a new QR/pairing.
    Only call this when the user explicitly wants to switch to a different WhatsApp number."""
    return whatsapp_service.clear_bridge_session()


@router.get("/profile")
async def get_whatsapp_profile(db: Session = Depends(get_db)):
    """Get the connected WhatsApp account's own profile (name, phone, picture).
    Fetches fresh from the bridge and upserts in DB; falls back to stored record."""
    from models.models import WhatsappSession, SessionStatus as SS
    session = db.query(WhatsappSession).filter(WhatsappSession.status == SS.connected).first()
    if not session or not session.phone:
        raise HTTPException(status_code=400, detail="No active WhatsApp session")
    from services.profile_service import fetch_and_save_profile
    return fetch_and_save_profile(db, session.phone)


@router.post("/send")
async def send_message(data: WhatsAppSendRequest, db: Session = Depends(get_db)):
    """Send a WhatsApp message directly."""
    try:
        return whatsapp_service.send_whatsapp_message(db, data.phone, data.message)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/qr")
async def get_qr(db: Session = Depends(get_db)):
    """Get current QR code if available."""
    from models.models import WhatsappSession
    session = db.query(WhatsappSession).order_by(WhatsappSession.id.desc()).first()
    if not session or not session.qr_code:
        raise HTTPException(status_code=404, detail="No QR code available")
    return {"qr": session.qr_code}


@router.post("/dev/connect")
async def dev_connect(phone: str = "+91 9876543210", db: Session = Depends(get_db)):
    """DEV ONLY: Mark session as connected without QR scan."""
    return whatsapp_service.simulate_connected(db, phone)


from pydantic import BaseModel
from datetime import datetime
from models.models import Message, MessageDirection, MessageStatus, WhatsappSession, SessionStatus
import logging
logger = logging.getLogger(__name__)

class WebhookPayload(BaseModel):
    phone: str
    content: str
    name: Optional[str] = None
    tags: Optional[List[str]] = None

@router.post("/webhook")
async def whatsapp_webhook(payload: WebhookPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Receive inbound messages from WhatsApp bridge."""
    try:
        phone = payload.phone
        content = payload.content
        
        # 1. Resolve contact by phone
        from services import contacts_service
        contact = contacts_service.get_contact_by_phone(db, phone)
        if not contact:
            # Auto-create a minimal contact so the message has a foreign-key target.
            # is_my_contact=False keeps it off the Contacts page (not in address book);
            # is_valid=True so the conversation still appears in the Messages page.
            from models.models import Contact as ContactModel
            active_session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
            contact = ContactModel(
                name=payload.name or f"WhatsApp User {phone}",
                phone=phone,
                tags=payload.tags or [],
                wa_account=active_session.phone if active_session else None,
                is_valid=True,
                is_my_contact=False,
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)
        else:
            needs_save = False
            # Backfill wa_account if missing (legacy contact or created before account field existed)
            if not contact.wa_account:
                active_session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
                if active_session:
                    contact.wa_account = active_session.phone
                    needs_save = True
            # Update placeholder name with real name from WhatsApp
            if payload.name and (contact.name.startswith("WhatsApp User") or contact.name.startswith("Unnamed") or contact.name == contact.phone):
                contact.name = payload.name
                needs_save = True
            if needs_save:
                db.add(contact)
                db.commit()
                db.refresh(contact)
            
        # 2. Save message
        active_session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
        wa_account = active_session.phone if active_session else None
        msg = Message(
            contact_id=contact.id,
            phone=phone,
            wa_account=wa_account,
            direction=MessageDirection.inbound,
            content=content,
            status=MessageStatus.read,
            sent_at=datetime.utcnow()
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        
        logger.info(f"Webhook received and saved message from {phone} ({contact.name})")

        # Push real-time event to all SSE subscribers
        try:
            from routes.messages import broadcast_message_event
            broadcast_message_event({
                "type": "new_message",
                "id": msg.id,
                "contact_id": contact.id,
                "phone": phone,
                "name": contact.name,
                "content": content,
                "direction": "inbound",
                "wa_account": wa_account,
            })
        except Exception:
            pass

        # 3. Trigger matching active automations in background
        from models.models import Automation, TriggerType
        from services.automation_runner import run_automation
        from database.connection import SessionLocal

        active_automations = db.query(Automation).filter(Automation.is_active == True).all()
        for automation in active_automations:
            should_trigger = False
            trigger_reason = ""

            if automation.trigger_type == TriggerType.message_received:
                should_trigger = True
                trigger_reason = "message_received"
            elif automation.trigger_type == TriggerType.keyword:
                keyword = automation.trigger_config.get("keyword") if automation.trigger_config else None
                if keyword and content.strip().lower() == keyword.strip().lower():
                    should_trigger = True
                    trigger_reason = f"keyword: {keyword}"
            elif automation.trigger_type == TriggerType.keyword_pattern:
                cfg = automation.trigger_config or {}
                pattern = cfg.get("pattern", "")
                mode = cfg.get("match_mode", "contains")
                c_lower = content.strip().lower()
                p_lower = pattern.strip().lower()
                if pattern:
                    import re as _re
                    if mode == "contains":
                        should_trigger = p_lower in c_lower
                    elif mode == "starts_with":
                        should_trigger = c_lower.startswith(p_lower)
                    elif mode == "ends_with":
                        should_trigger = c_lower.endswith(p_lower)
                    elif mode == "regex":
                        try:
                            should_trigger = bool(_re.search(pattern, content, _re.IGNORECASE))
                        except Exception:
                            should_trigger = False
                    if should_trigger:
                        trigger_reason = f"pattern({mode}): {pattern}"

            if should_trigger:
                # Cooldown check — skip if ran within cooldown window
                cooldown = getattr(automation, "cooldown_minutes", 0) or 0
                if cooldown > 0:
                    from datetime import timedelta
                    from models.models import AutomationLog
                    cutoff = datetime.utcnow() - timedelta(minutes=cooldown)
                    recent = db.query(AutomationLog).filter(
                        AutomationLog.automation_id == automation.id,
                        AutomationLog.started_at >= cutoff,
                    ).first()
                    if recent:
                        logger.info(f"Automation '{automation.name}' skipped — cooldown {cooldown}min not expired")
                        should_trigger = False

            if should_trigger:
                logger.info(f"Triggering automation '{automation.name}' (ID: {automation.id}) via {trigger_reason}")

                # Background runner wrapper to use fresh DB session (avoids request lifecycle closing issues)
                def bg_run(auto_id, trig_data):
                    bg_db = SessionLocal()
                    try:
                        run_automation(bg_db, auto_id, trig_data)
                    except Exception as bg_err:
                        logger.error(f"Background automation run failed: {bg_err}")
                    finally:
                        bg_db.close()

                trigger_data = {
                    "phone": phone,
                    "content": content,
                    "contact_id": contact.id
                }
                background_tasks.add_task(bg_run, automation.id, trigger_data)

        return {"success": True, "message_id": msg.id}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"success": False, "error": str(e)}
