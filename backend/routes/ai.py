"""
AI Routes — Smart reply generation and settings management.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from database.connection import get_db

router = APIRouter(prefix="/ai", tags=["AI"])


# ─── Schemas ──────────────────────────────────────────────────────

class ConversationMessage(BaseModel):
    role: str     # "user" or "assistant"
    content: str


class AIReplyRequest(BaseModel):
    messages: List[ConversationMessage]
    # Optional per-request overrides (useful for testing; normally use stored settings)
    provider: Optional[str] = None
    tone: Optional[str] = None
    language: Optional[str] = None
    model: Optional[str] = None


class AISettingsUpdate(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    tone: Optional[str] = None
    language: Optional[str] = None
    model: Optional[str] = None
    enabled: Optional[bool] = None
    auto_suggest: Optional[bool] = None


# ─── Settings ─────────────────────────────────────────────────────

@router.get("/settings")
async def get_ai_settings(db: Session = Depends(get_db)):
    """Return current AI settings. The raw API key is never exposed — only a masked preview."""
    from services.ai_service import get_ai_settings as _get
    s = _get(db)
    raw_key = s.pop("api_key", "")
    if raw_key:
        # Show first 4 + last 4 characters, mask the rest
        visible = min(4, len(raw_key) // 3)
        s["api_key_masked"] = raw_key[:visible] + "•" * max(4, len(raw_key) - visible * 2) + raw_key[-visible:]
        s["has_api_key"] = True
    else:
        s["api_key_masked"] = ""
        s["has_api_key"] = False
    return s


@router.post("/settings")
async def update_ai_settings(data: AISettingsUpdate, db: Session = Depends(get_db)):
    """Persist AI settings. Omit api_key or leave it blank to keep the existing stored key."""
    from services.ai_service import save_ai_settings as _save
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    result = _save(db, updates)
    result.pop("api_key", None)
    return result


# ─── Reply generation ─────────────────────────────────────────────

@router.post("/reply")
async def generate_ai_reply(data: AIReplyRequest, db: Session = Depends(get_db)):
    """Generate a smart reply from conversation history using the configured AI provider."""
    from services.ai_service import generate_reply, get_ai_settings as _get

    stored = _get(db)
    provider = data.provider or stored["provider"]
    api_key = stored["api_key"]
    tone = data.tone or stored["tone"]
    language = data.language or stored["language"]
    model = data.model or stored["model"]

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Go to Settings → AI Integration to add your key."
        )

    messages = [{"role": m.role, "content": m.content} for m in data.messages]
    if not messages:
        raise HTTPException(status_code=422, detail="messages list cannot be empty")

    try:
        reply = await generate_reply(
            messages=messages,
            provider=provider,
            api_key=api_key,
            tone=tone,
            language=language,
            model=model,
        )
        return {"reply": reply, "provider": provider}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI provider error: {str(e)}")


@router.post("/test")
async def test_ai_connection(db: Session = Depends(get_db)):
    """Ping the configured AI provider to verify the API key works."""
    from services.ai_service import generate_reply, get_ai_settings as _get
    stored = _get(db)

    if not stored["api_key"]:
        raise HTTPException(status_code=400, detail="No API key configured")

    try:
        reply = await generate_reply(
            messages=[{"role": "user", "content": "Say 'OK' and nothing else."}],
            provider=stored["provider"],
            api_key=stored["api_key"],
            tone="professional",
            language="en",
            model=stored["model"],
        )
        return {"success": True, "reply": reply, "provider": stored["provider"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
