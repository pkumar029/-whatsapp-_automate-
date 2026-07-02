"""
WhatsApp Routes — Connect, disconnect, status, send message
"""
import asyncio
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from typing import Optional, List
from sqlalchemy.orm import Session
from database.connection import get_db
from services import whatsapp_service
from models.schemas import WhatsAppSendRequest, WhatsAppStatusResponse, WhatsAppConnectResponse, WhatsAppConnectRequest
from dependencies import current_user_id

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.get("/status", response_model=WhatsAppStatusResponse)
async def get_status(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get current WhatsApp session status."""
    return whatsapp_service.get_session_status(db, user_id)


@router.get("/events")
async def whatsapp_events(request: Request):
    """SSE stream — proxies real-time bridge events so the frontend login flow
    gets instant QR, connected, and disconnected notifications without polling."""

    async def generator():
        # Send current bridge state immediately on connect
        try:
            async with httpx.AsyncClient(timeout=3.0) as hc:
                r = await hc.get("http://localhost:7002/status")
                if r.status_code == 200:
                    d = r.json()
                    yield f"data: {json.dumps({'type': 'status', 'bridge_status': d.get('status'), 'qr': d.get('qr'), 'phone': d.get('phone'), 'pairing_code': d.get('pairing_code')})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'type': 'status', 'bridge_status': 'unavailable'})}\n\n"

        # Proxy the bridge's SSE stream; fall back to polling if unavailable
        bridge_sse_ok = False
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=3.0)) as hc:
                async with hc.stream("GET", "http://localhost:7002/events") as stream:
                    bridge_sse_ok = True
                    async for line in stream.aiter_lines():
                        if await request.is_disconnected():
                            return
                        if line.strip():
                            yield f"{line}\n\n"
        except Exception:
            pass

        if not bridge_sse_ok:
            # Bridge doesn't support SSE yet — fall back to 1.5 s polling
            while True:
                if await request.is_disconnected():
                    return
                await asyncio.sleep(1.5)
                try:
                    async with httpx.AsyncClient(timeout=3.0) as hc:
                        r = await hc.get("http://localhost:7002/status")
                        if r.status_code == 200:
                            d = r.json()
                            payload = json.dumps({
                                'type': 'status',
                                'bridge_status': d.get('status'),
                                'qr': d.get('qr'),
                                'phone': d.get('phone'),
                                'pairing_code': d.get('pairing_code'),
                            })
                            yield f"data: {payload}\n\n"
                except Exception:
                    pass

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/connect", response_model=WhatsAppConnectResponse)
async def connect(data: WhatsAppConnectRequest, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Initiate WhatsApp connection with specific configuration."""
    try:
        return whatsapp_service.connect_whatsapp_with_config(db, data, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect")
async def disconnect(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Disconnect WhatsApp session."""
    try:
        return whatsapp_service.disconnect_whatsapp(db, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-session")
async def clear_session():
    """Wipe the bridge's saved WhatsApp session so the next connect requires a new QR/pairing.
    Only call this when the user explicitly wants to switch to a different WhatsApp number."""
    return whatsapp_service.clear_bridge_session()


@router.get("/profile")
async def get_whatsapp_profile(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get the connected WhatsApp account's own profile (name, phone, picture).
    Fetches fresh from the bridge and upserts in DB; falls back to stored record."""
    from models.models import WhatsappSession, SessionStatus as SS
    session = db.query(WhatsappSession).filter(WhatsappSession.user_id == user_id, WhatsappSession.status == SS.connected).first()
    if not session or not session.phone:
        return {"success": False, "detail": "No active WhatsApp session"}
    from services.profile_service import fetch_and_save_profile
    return fetch_and_save_profile(db, session.phone, user_id)


@router.post("/send")
async def send_message(data: WhatsAppSendRequest, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Send a WhatsApp message directly."""
    try:
        return whatsapp_service.send_whatsapp_message(db, data.phone, data.message, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/qr")
async def get_qr(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get current QR code if available."""
    from models.models import WhatsappSession
    session = db.query(WhatsappSession).filter(WhatsappSession.user_id == user_id).order_by(WhatsappSession.id.desc()).first()
    if not session or not session.qr_code:
        raise HTTPException(status_code=404, detail="No QR code available")
    return {"qr": session.qr_code}


@router.post("/dev/connect")
async def dev_connect(phone: str = "+91 9876543210", db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """DEV ONLY: Mark session as connected without QR scan."""
    return whatsapp_service.simulate_connected(db, user_id, phone)


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
    messageId: Optional[str] = None

@router.post("/webhook")
async def whatsapp_webhook(payload: WebhookPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Receive inbound messages from WhatsApp bridge.

    Called by the Node bridge itself, not an authenticated browser — there's
    no JWT here. Until Phase 3 (per-user bridge sessions) lands, only one
    user can be genuinely connected via the bridge at a time, so "the"
    connected session IS the message's owner. That owner's user_id is then
    threaded through contact/message creation and automation matching so
    nothing here leaks across users even once multiple sessions exist.
    """
    try:
        phone = payload.phone
        content = payload.content

        active_session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
        owner_user_id = active_session.user_id if active_session else None
        wa_account = active_session.phone if active_session else None

        if owner_user_id is None:
            logger.warning(f"Webhook message from {phone} dropped — no connected WhatsApp session to attribute it to")
            return {"success": False, "error": "No connected WhatsApp session"}

        # 1. Resolve contact by phone
        from services import contacts_service
        contact = contacts_service.get_contact_by_phone(db, phone, owner_user_id, wa_account)
        if not contact:
            # Auto-create a minimal contact so the message has a foreign-key target.
            # is_my_contact=False keeps it off the Contacts page (not in address book);
            # is_valid=True so the conversation still appears in the Messages page.
            from models.models import Contact as ContactModel
            contact = ContactModel(
                user_id=owner_user_id,
                name=payload.name or f"WhatsApp User {phone}",
                phone=phone,
                tags=payload.tags or [],
                wa_account=wa_account,
                is_valid=True,
                is_my_contact=False,
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)
        else:
            needs_save = False
            # Backfill wa_account if missing (legacy contact or created before account field existed)
            if not contact.wa_account and wa_account:
                contact.wa_account = wa_account
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
        msg = Message(
            user_id=owner_user_id,
            contact_id=contact.id,
            phone=phone,
            wa_account=wa_account,
            direction=MessageDirection.inbound,
            content=content,
            status=MessageStatus.read,
            whatsapp_message_id=payload.messageId,
            sent_at=datetime.utcnow()
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)

        logger.info(f"Webhook received and saved message from {phone} ({contact.name})")

        # Push real-time event to this user's SSE subscribers only
        try:
            from routes.messages import broadcast_message_event
            broadcast_message_event(owner_user_id, {
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

        # 3. Trigger matching active automations (this user's only) in background
        from models.models import Automation, TriggerType
        from services.automation_runner import run_automation
        from database.connection import SessionLocal

        active_automations = db.query(Automation).filter(
            Automation.is_active == True,
            Automation.user_id == owner_user_id,
        ).filter(
            (Automation.wa_account == wa_account) | Automation.wa_account.is_(None)
        ).all()
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
                    "contact_id": contact.id,
                    "whatsapp_message_id": payload.messageId
                }
                background_tasks.add_task(bg_run, automation.id, trigger_data)

        return {"success": True, "message_id": msg.id}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"success": False, "error": str(e)}
