"""
Auth Routes — Application login, current user, and password management.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


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


@router.post("/register", status_code=201)
async def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account."""
    from models.models import User
    from services.auth_service import hash_password, create_access_token

    name = data.name.strip()
    username = data.username.lower().strip()
    if not name or not username or not data.password:
        raise HTTPException(status_code=400, detail="Name, username, and password are required")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = db.query(User).filter(User.email == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        name=name,
        email=username,
        password_hash=hash_password(data.password),
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


@router.get("/auto-token")
async def auto_token(db: Session = Depends(get_db)):
    """Return a JWT for the default admin user — no credentials needed.
    Used by single-user installations to avoid manual login."""
    from models.models import User
    from services.auth_service import create_access_token
    user = db.query(User).filter(User.is_active == True).order_by(User.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="No user configured")
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


@router.post("/login")
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with username + password and receive a JWT access token."""
    from models.models import User
    from services.auth_service import verify_password, create_access_token

    user = db.query(User).filter(User.email == data.username.lower().strip()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

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
    """Update the current user's name or username."""
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


@router.post("/change-password")
async def change_password(data: ChangePasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Change the current user's password after verifying the old one."""
    from services.auth_service import verify_password, hash_password
    from datetime import datetime
    user = _get_user_from_request(request, db)

    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if data.old_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    user.password_hash = hash_password(data.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "Password changed successfully"}
