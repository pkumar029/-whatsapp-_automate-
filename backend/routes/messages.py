"""
Messages Routes — Send, list, filter messages, SSE stream
"""
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import messages_service
from models.schemas import MessageSend, MessageListResponse

router = APIRouter(prefix="/messages", tags=["Messages"])

# ─── SSE broadcaster ────────────────────────────────────────────
_sse_queues: list[asyncio.Queue] = []

def broadcast_message_event(data: dict) -> None:
    """Push a new-message event to all connected SSE clients."""
    payload = json.dumps(data)
    for q in _sse_queues[:]:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass

@router.get("/stream")
async def message_stream(request: Request):
    """Server-Sent Events endpoint — pushes new inbound messages in real-time."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _sse_queues.append(queue)

    async def generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=20)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"   # keep connection alive
        finally:
            try:
                _sse_queues.remove(queue)
            except ValueError:
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


@router.get("", response_model=MessageListResponse)
async def list_messages(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None),
    direction: Optional[str] = Query(None, pattern="^(inbound|outbound)$"),
    contact_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """List messages with filtering and pagination."""
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
    wa_account = session.phone if session else None
    
    return messages_service.get_messages(
        db, page=page, limit=limit, search=search,
        direction=direction, contact_id=contact_id, wa_account=wa_account
    )
@router.post("/sync")
async def sync_messages(db: Session = Depends(get_db)):
    """Pull full chat + message history from the bridge for the active account."""
    result = messages_service.sync_message_history(db)
    if not result.get("success"):
        raise HTTPException(status_code=503, detail=result.get("message", "Sync failed"))
    return result


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
    limit: int = Query(50, ge=1, le=500),
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
