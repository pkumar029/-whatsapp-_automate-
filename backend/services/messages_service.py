"""
Messages Service — send, validate, save records, track status
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


def get_messages(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    direction: Optional[str] = None,
    contact_id: Optional[int] = None,
    wa_account: Optional[str] = None,
) -> dict:
    query = db.query(Message)

    if wa_account:
        # Include contacts belonging to this account OR with no account set (manually added)
        query = query.join(Contact).filter(
            or_(Contact.wa_account == wa_account, Contact.wa_account.is_(None))
        )

    if search:
        s = f"%{search}%"
        query = query.filter(or_(Message.content.ilike(s), Message.phone.ilike(s)))
    if direction:
        query = query.filter(Message.direction == direction)
    if contact_id:
        query = query.filter(Message.contact_id == contact_id)

    total = query.count()
    messages = query.order_by(Message.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    # Attach contact names
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
    # Resolve phone
    phone = data.phone
    contact_id = data.contact_id

    if contact_id and not phone:
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            raise ValueError(f"Contact ID {contact_id} not found")
        phone = contact.phone

    if not phone:
        raise ValueError("Phone number is required")

    # Create message record
    msg = Message(
        contact_id=contact_id,
        phone=phone,
        direction=MessageDirection.outbound,
        content=data.message,
        media_url=data.media_url,
        media_type=data.media_type,
        status=MessageStatus.pending,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Attempt to send via WhatsApp
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


def get_sent_count(db: Session, wa_account: Optional[str] = None) -> int:
    query = db.query(func.count(Message.id)).filter(Message.status == MessageStatus.sent)
    if wa_account:
        query = query.join(Contact).filter(
            or_(Contact.wa_account == wa_account, Contact.wa_account.is_(None))
        )
    return query.scalar() or 0


def get_failed_count(db: Session, wa_account: Optional[str] = None) -> int:
    query = db.query(func.count(Message.id)).filter(Message.status == MessageStatus.failed)
    if wa_account:
        query = query.join(Contact).filter(
            or_(Contact.wa_account == wa_account, Contact.wa_account.is_(None))
        )
    return query.scalar() or 0
