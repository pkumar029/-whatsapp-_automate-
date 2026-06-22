"""
Messages Routes — Send, list, filter messages
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import messages_service
from models.schemas import MessageSend, MessageListResponse

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.get("", response_model=MessageListResponse)
async def list_messages(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    direction: Optional[str] = Query(None, pattern="^(inbound|outbound)$"),
    contact_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """List messages with filtering and pagination."""
    return messages_service.get_messages(
        db, page=page, limit=limit, search=search,
        direction=direction, contact_id=contact_id
    )


@router.post("/send", status_code=201)
async def send_message(data: MessageSend, db: Session = Depends(get_db)):
    """Send a WhatsApp message."""
    try:
        msg = messages_service.send_message(db, data)
        return {"success": True, "message_id": msg.id, "status": msg.status.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contact/{contact_id}", response_model=MessageListResponse)
async def messages_by_contact(
    contact_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get all messages for a specific contact."""
    return messages_service.get_messages(db, page=page, limit=limit, contact_id=contact_id)


@router.get("/{message_id}")
async def get_message(message_id: int, db: Session = Depends(get_db)):
    """Get a single message by ID."""
    from models.models import Message
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg
