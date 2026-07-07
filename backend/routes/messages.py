"""
Messages Routes — Send, list, filter messages, SSE stream
"""
import asyncio
import json
import re
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import messages_service
from models.schemas import MessageSend, MessageListResponse
from dependencies import current_user_id

router = APIRouter(prefix="/messages", tags=["Messages"])

# ─── SSE broadcaster (per user) ─────────────────────────────────
# Keyed by user_id — public endpoint (EventSource can't send auth headers),
# so message *content* would otherwise leak to every connected browser tab
# regardless of who it belongs to.
_sse_queues: dict[int, list[asyncio.Queue]] = {}

def broadcast_message_event(user_id: int, data: dict) -> None:
    """Push a new-message event to this user's connected SSE clients only."""
    payload = json.dumps(data)
    for q in _sse_queues.get(user_id, [])[:]:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass

@router.get("/stream")
async def message_stream(request: Request, user_id: int = Query(...), ticket: str = Query(...)):
    """Server-Sent Events endpoint — pushes new inbound messages in real-time.
    Public (EventSource can't send auth headers), so the caller passes a
    short-lived, stream-scoped ticket (GET /auth/stream-ticket) instead of the
    main JWT — without this check anyone could pass an arbitrary user_id and
    read another user's message content live, and the main long-lived JWT
    should never sit in a URL that proxies/browsers log."""
    from services.auth_service import user_id_from_stream_ticket
    if user_id_from_stream_ticket(ticket) != user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired stream ticket")
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _sse_queues.setdefault(user_id, []).append(queue)

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
                _sse_queues.get(user_id, []).remove(queue)
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
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """List messages with filtering and pagination."""
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(
        WhatsappSession.user_id == user_id, WhatsappSession.status == SessionStatus.connected
    ).first()
    wa_account = session.phone if session else None

    return messages_service.get_messages(
        db, user_id, page=page, limit=limit, search=search,
        direction=direction, contact_id=contact_id, wa_account=wa_account
    )
@router.post("/sync")
async def sync_messages(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Pull full chat + message history from the bridge for the active account."""
    result = messages_service.sync_message_history(db, user_id)
    if not result.get("success"):
        raise HTTPException(status_code=503, detail=result.get("message", "Sync failed"))
    return result


@router.post("/send", status_code=201)
async def send_message(data: MessageSend, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Send a WhatsApp message.

    A message row is always saved (for the send-attempt log), but this only
    ever reports success when WhatsApp actually accepted the message — a
    failed send raises so the client sees the real reason instead of a
    false "sent".
    """
    from services.whatsapp_service import WhatsAppSendError, ServiceUnavailableError
    try:
        msg = messages_service.send_message(db, data, user_id)
        return {"success": True, "message_id": msg.id, "status": msg.status.value}
    except ServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except WhatsAppSendError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{message_id}/retry")
async def retry_message(message_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Retry a previously failed outbound message."""
    from services.whatsapp_service import WhatsAppSendError, ServiceUnavailableError
    try:
        msg = messages_service.retry_message(db, message_id, user_id)
        return {"success": True, "message_id": msg.id, "status": msg.status.value}
    except ServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except WhatsAppSendError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contact/{contact_id}", response_model=MessageListResponse)
async def messages_by_contact(
    contact_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """Get all messages for a specific contact."""
    return messages_service.get_messages(db, user_id, page=page, limit=limit, contact_id=contact_id)


@router.get("/{message_id:int}")
async def get_message(message_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get a single message by ID."""
    from models.models import Message
    msg = db.query(Message).filter(Message.id == message_id, Message.user_id == user_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


# ─── Grammar & Spell Check ─────────────────────────────────────

class GrammarCheckRequest(BaseModel):
    text: str
    language: str = "en-US"

# Spans to skip during correction (URLs, phone numbers, backtick code)
_SKIP_PATTERNS = re.compile(
    r'https?://\S+'             # URLs
    r'|`[^`]+`'                 # inline code
    r'|\+?\d[\d\s\-()]{6,}\d'  # phone numbers (7+ digit sequences)
)


def _apply_corrections(text: str, matches: list) -> str:
    """Apply LanguageTool replacements in reverse order, skipping URL/phone spans."""
    skip_spans = {(m.start(), m.end()) for m in _SKIP_PATTERNS.finditer(text)}

    def _overlaps_skip(off, ln):
        end = off + ln
        return any(s <= off < e or s < end <= e for s, e in skip_spans)

    corrected = text
    offset_shift = 0
    for match in sorted(matches, key=lambda m: m["offset"]):
        if not match.get("replacements"):
            continue
        orig_off = match["offset"]
        orig_len = match["length"]
        if _overlaps_skip(orig_off, orig_len):
            continue
        replacement = match["replacements"][0]["value"]
        adj_off = orig_off + offset_shift
        corrected = corrected[:adj_off] + replacement + corrected[adj_off + orig_len:]
        offset_shift += len(replacement) - orig_len

    return corrected


@router.post("/check-grammar")
async def check_grammar(data: GrammarCheckRequest):
    """Check spelling and grammar via LanguageTool free public API.

    Passes raw text directly — LanguageTool natively ignores most URLs.
    Post-processing skips corrections that would touch URL/phone spans.
    Returns matches (with position/suggestion info) and a pre-computed corrected string.
    """
    import httpx
    text = data.text.strip()
    if not text or len(text) < 3:
        return {"matches": [], "corrected": text, "issues": 0}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "https://api.languagetool.org/v2/check",
                data={"text": text, "language": data.language},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code == 429:
            return {"matches": [], "corrected": text, "issues": 0, "error": "Rate limit — try again in a moment"}
        if r.status_code != 200:
            return {"matches": [], "corrected": text, "issues": 0}

        result = r.json()
        matches = result.get("matches", [])
        corrected = _apply_corrections(text, matches)

        return {
            "matches": matches,
            "corrected": corrected,
            "issues": len(matches),
        }
    except Exception:
        return {"matches": [], "corrected": text, "issues": 0}
