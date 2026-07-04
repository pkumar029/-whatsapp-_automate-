"""
Auth Routes — Device-bound authentication and current user profile.

There's no email/password anymore. A browser silently gets its own account
via POST /auth/device the first time it opens the app, before any WhatsApp
connection exists. That account's identity is not the phone number for now —
the WhatsApp connection is just a session hanging off whichever device
account is talking to the API — but future automation/message/contact rows
still keep the per-user isolation this schema already provides.
"""
import secrets
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None


def _get_user_from_request(request: Request, db: Session):
    """Read user_id injected by JWTAuthMiddleware from request state."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from models.models import User
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


@router.post("/device", status_code=201)
async def device_login(db: Session = Depends(get_db)):
    """Silently create a new device-bound account and return its token.

    Called automatically by the frontend the first time a browser has no
    stored token — no user input required. password_hash is populated with
    a random, never-checked value purely to satisfy the column constraint;
    nothing ever authenticates against it.
    """
    from models.models import User
    from services.auth_service import create_access_token

    placeholder_email = f"device-{uuid.uuid4().hex}@device.local"
    user = User(
        name="WhatsApp User",
        email=placeholder_email,
        password_hash=secrets.token_hex(32),
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, user.name)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "username": user.email,
            "is_admin": user.is_admin,
        },
    }


@router.post("/logout")
async def logout():
    """Logout — client should discard the JWT; server is stateless."""
    return {"success": True, "message": "Logged out"}


@router.get("/me")
async def get_me(request: Request, db: Session = Depends(get_db)):
    """Return the currently authenticated user's profile."""
    user = _get_user_from_request(request, db)
    return {
        "id": user.id,
        "name": user.name,
        "username": user.email,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.put("/me")
async def update_me(data: UpdateProfileRequest, request: Request, db: Session = Depends(get_db)):
    """Update the current user's display name (or internal username)."""
    from datetime import datetime
    user = _get_user_from_request(request, db)
    if data.name:
        user.name = data.name.strip()
    if data.username:
        new_username = data.username.lower().strip()
        from models.models import User
        conflict = db.query(User).filter(User.email == new_username, User.id != user.id).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Username already taken")
        user.email = new_username
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"id": user.id, "name": user.name, "username": user.email, "is_admin": user.is_admin}
