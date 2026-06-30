"""
AI Service — Smart reply generation via OpenAI or Google Gemini.
Settings are persisted in the SystemSettings table (key-value pairs).
"""
import httpx
import logging

logger = logging.getLogger(__name__)

# ─── Provider implementations ─────────────────────────────────────

async def _call_openai(system: str, messages: list, api_key: str, model: str) -> str:
    payload = {
        "model": model or "gpt-4o-mini",
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 350,
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            "https://api.openai.com/v1/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if r.status_code == 401:
        raise ValueError("Invalid OpenAI API key. Check Settings → AI Integration.")
    if r.status_code == 429:
        raise ValueError("OpenAI rate limit reached. Try again in a moment.")
    if r.status_code != 200:
        raise ValueError(f"OpenAI error {r.status_code}: {r.text[:200]}")
    return r.json()["choices"][0]["message"]["content"].strip()


async def _call_gemini(system: str, messages: list, api_key: str, model: str) -> str:
    contents = []
    for m in messages:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system}]},
        "generationConfig": {"maxOutputTokens": 350, "temperature": 0.7},
    }
    model_name = model or "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload)

    if r.status_code == 400:
        raise ValueError("Invalid Gemini API key. Check Settings → AI Integration.")
    if r.status_code == 429:
        raise ValueError("Gemini rate limit reached. Try again in a moment.")
    if r.status_code != 200:
        raise ValueError(f"Gemini error {r.status_code}: {r.text[:200]}")
    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


# ─── Public API ───────────────────────────────────────────────────

async def generate_reply(
    messages: list,        # [{"role": "user"|"assistant", "content": "..."}]
    provider: str,
    api_key: str,
    tone: str = "professional",
    language: str = "auto",
    model: str = "",
) -> str:
    """Generate a WhatsApp reply using the configured AI provider."""
    if not api_key:
        raise ValueError("No API key configured. Go to Settings → AI Integration.")

    lang_hint = (
        "Respond in the same language the customer is writing in."
        if language == "auto"
        else f"Always respond in {language}."
    )
    system = (
        f"You are a helpful WhatsApp business assistant. "
        f"Write a concise reply to the customer's latest message. "
        f"Tone: {tone}. {lang_hint} "
        f"Keep it brief and natural for WhatsApp (2–3 sentences max unless more detail is essential). "
        f"Output ONLY the reply text — no quotes, labels, or markdown."
    )

    if provider == "openai":
        return await _call_openai(system, messages, api_key, model)
    elif provider == "gemini":
        return await _call_gemini(system, messages, api_key, model)
    else:
        raise ValueError(f"Unknown AI provider: {provider!r}")


# ─── Settings helpers ─────────────────────────────────────────────

_AI_KEYS = {
    "provider": "ai_provider",
    "api_key": "ai_api_key",
    "tone": "ai_tone",
    "language": "ai_language",
    "model": "ai_model",
    "enabled": "ai_enabled",
    "auto_suggest": "ai_auto_suggest",
}
_DEFAULTS = {
    "provider": "openai",
    "api_key": "",
    "tone": "professional",
    "language": "auto",
    "model": "",
    "enabled": False,
    "auto_suggest": False,
}


def get_ai_settings(db) -> dict:
    from models.models import SystemSettings
    rows = {r.key: r.value for r in db.query(SystemSettings).filter(
        SystemSettings.key.in_(_AI_KEYS.values())
    ).all()}
    result = dict(_DEFAULTS)
    for field, db_key in _AI_KEYS.items():
        if db_key in rows:
            raw = rows[db_key]
            if field in ("enabled", "auto_suggest"):
                result[field] = raw.lower() == "true"
            else:
                result[field] = raw
    return result


def save_ai_settings(db, updates: dict) -> dict:
    from models.models import SystemSettings
    from datetime import datetime

    for field, db_key in _AI_KEYS.items():
        if field not in updates:
            continue
        val = updates[field]
        # Never erase an existing API key with a blank value
        if field == "api_key" and not str(val).strip():
            continue
        str_val = str(val).lower() if isinstance(val, bool) else str(val)
        row = db.query(SystemSettings).filter(SystemSettings.key == db_key).first()
        if row:
            row.value = str_val
            row.updated_at = datetime.utcnow()
        else:
            db.add(SystemSettings(key=db_key, value=str_val))

    db.commit()
    return get_ai_settings(db)
