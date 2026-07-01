"""
Messages Service — send, validate, save records, track status, sync history
"""
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from models.models import Message, Contact, MessageDirection, MessageStatus
from models.schemas import MessageSend
from services import whatsapp_service

logger = logging.getLogger(__name__)


def _active_account(db: Session) -> Optional[str]:
    """Return the phone of the currently connected WhatsApp account."""
    from models.models import WhatsappSession, SessionStatus
    s = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
    return s.phone if s else None


def get_messages(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    direction: Optional[str] = None,
    contact_id: Optional[int] = None,
    wa_account: Optional[str] = None,
) -> dict:
    if not wa_account and not contact_id:
        return {"messages": [], "total": 0, "page": page, "limit": limit}

    query = db.query(Message)

    if contact_id:
        query = query.filter(Message.contact_id == contact_id)
        # Include legacy messages that predate the wa_account stamp; exclude
        # only messages that are stamped for a DIFFERENT account.
        if wa_account:
            query = query.filter(
                or_(Message.wa_account == wa_account, Message.wa_account == None)
            )
    else:
        # Without a contact filter, enforce strict account isolation
        if wa_account:
            query = query.filter(Message.wa_account == wa_account)

    if search:
        s = f"%{search}%"
        query = query.filter(or_(Message.content.ilike(s), Message.phone.ilike(s)))
    if direction:
        query = query.filter(Message.direction == direction)

    total = query.count()
    messages = query.order_by(Message.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for m in messages:
        item = m.__dict__.copy()
        item.pop('_sa_instance_state', None)
        if m.contact_id:
            contact = db.query(Contact).filter(Contact.id == m.contact_id).first()
            item['contact_name'] = contact.name if contact else None
        else:
            item['contact_name'] = None
        result.append(item)

    return {"messages": result, "total": total, "page": page, "limit": limit}


def send_message(db: Session, data: MessageSend) -> Message:
    """Validate, send via WhatsApp, and save message record."""
    phone = data.phone
    contact_id = data.contact_id

    if contact_id and not phone:
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            raise ValueError(f"Contact ID {contact_id} not found")
        phone = contact.phone

    if not phone:
        raise ValueError("Phone number is required")

    wa_account = _active_account(db)

    msg = Message(
        contact_id=contact_id,
        phone=phone,
        wa_account=wa_account,
        direction=MessageDirection.outbound,
        content=data.message,
        media_url=data.media_url,
        media_type=data.media_type,
        status=MessageStatus.pending,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    try:
        result = whatsapp_service.send_whatsapp_message(db, phone, data.message)
        msg.status = MessageStatus.sent
        msg.whatsapp_message_id = result.get("message_id")
        msg.sent_at = datetime.utcnow()
    except Exception as e:
        logger.error(f"Failed to send message: {e}")
        msg.status = MessageStatus.failed
        msg.error_message = str(e)

    db.commit()
    db.refresh(msg)
    return msg


def sync_message_history(db: Session) -> dict:
    """
    Fetch chat + message history from the bridge and store in the DB.
    Deduplicates by whatsapp_message_id — safe to call repeatedly.
    """
    import httpx
    import re as _re
    from services.contacts_service import get_contact_by_phone

    wa_account = _active_account(db)
    if not wa_account:
        return {"success": False, "message": "No active WhatsApp account"}

    try:
        r = httpx.get("http://localhost:7002/sync-messages", timeout=60.0)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"sync_message_history: bridge unreachable — {e}")
        return {"success": False, "message": str(e)}

    if not data.get("success"):
        return {"success": False, "message": data.get("error", "Bridge returned failure")}

    chats_saved = 0
    messages_saved = 0
    messages_skipped = 0

    # WhatsApp-specific phone length limit (mirrors bridge contacts filter)
    _WA_PHONE_RE = _re.compile(r'^\+\d{7,13}$')

    for chat in data.get("chats", []):
        phone = chat.get("phone")
        name = chat.get("name") or phone
        chat_messages = chat.get("messages", [])
        is_group = chat.get("isGroup", False)
        if not phone or not chat_messages:
            continue

        # Skip non-group chats with invalid/too-long phone numbers
        if not is_group and not _WA_PHONE_RE.match(phone):
            logger.debug(f"sync_message_history: skipping invalid phone {phone!r}")
            continue

        # Resolve or create contact
        contact = get_contact_by_phone(db, phone)
        if not contact:
            # Auto-created from chat history — not a saved address-book contact.
            # is_valid=True so the conversation appears in Messages; is_my_contact=False
            # keeps it out of the Contacts page.
            contact = Contact(
                name=name, phone=phone,
                wa_account=wa_account,
                is_valid=True, is_my_contact=False,
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)
        if not contact.wa_account:
            contact.wa_account = wa_account
            db.add(contact)
            db.commit()
            db.refresh(contact)

        chats_saved += 1

        for raw in chat_messages:
            wa_msg_id = raw.get("id")
            body = raw.get("body", "")
            from_me = raw.get("fromMe", False)
            ts = raw.get("timestamp")

            if not body:
                continue

            # Dedup by WhatsApp message ID
            if wa_msg_id:
                exists = db.query(Message.id).filter(
                    Message.whatsapp_message_id == wa_msg_id
                ).first()
                if exists:
                    messages_skipped += 1
                    continue

            direction = MessageDirection.outbound if from_me else MessageDirection.inbound
            sent_at = datetime.utcfromtimestamp(ts / 1000) if ts else datetime.utcnow()

            msg = Message(
                contact_id=contact.id,
                phone=phone,
                wa_account=wa_account,
                direction=direction,
                content=body,
                status=MessageStatus.sent if from_me else MessageStatus.read,
                whatsapp_message_id=wa_msg_id,
                sent_at=sent_at,
                created_at=sent_at,
            )
            db.add(msg)
            messages_saved += 1

        if messages_saved > 0 and messages_saved % 200 == 0:
            db.commit()

    db.commit()
    logger.info(
        f"sync_message_history: {chats_saved} chats, "
        f"{messages_saved} new messages, {messages_skipped} skipped"
    )
    return {
        "success": True,
        "chats": chats_saved,
        "messages_saved": messages_saved,
        "messages_skipped": messages_skipped,
    }


def get_sent_count(db: Session, wa_account: Optional[str] = None) -> int:
    q = db.query(func.count(Message.id)).filter(Message.status == MessageStatus.sent)
    if wa_account:
        q = q.filter(Message.wa_account == wa_account)
    return q.scalar() or 0


def get_failed_count(db: Session, wa_account: Optional[str] = None) -> int:
    q = db.query(func.count(Message.id)).filter(Message.status == MessageStatus.failed)
    if wa_account:
        q = q.filter(Message.wa_account == wa_account)
    return q.scalar() or 0


def get_received_count(db: Session, wa_account: Optional[str] = None) -> int:
    q = db.query(func.count(Message.id)).filter(Message.direction == MessageDirection.inbound)
    if wa_account:
        q = q.filter(Message.wa_account == wa_account)
    return q.scalar() or 0
