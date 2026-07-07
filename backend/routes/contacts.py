"""
Contacts Routes — Full CRUD with search and filtering
"""
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import contacts_service
from models.schemas import ContactCreate, ContactUpdate, ContactResponse, ContactListResponse
from models.models import Contact
from dependencies import current_user_id

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=ContactListResponse)
async def list_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=2000),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    wa_account: Optional[str] = Query(None),
    saved_only: bool = Query(False, description="When true, return only address-book contacts"),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """List contacts with pagination and optional search."""
    if not wa_account:
        from models.models import WhatsappSession, SessionStatus
        session = db.query(WhatsappSession).filter(
            WhatsappSession.user_id == user_id, WhatsappSession.status == SessionStatus.connected
        ).first()
        if session:
            wa_account = session.phone

    return contacts_service.get_contacts(
        db, user_id, page=page, limit=limit, search=search,
        is_active=is_active, wa_account=wa_account, saved_only=saved_only
    )


@router.post("", response_model=ContactResponse, status_code=201)
async def create_contact(data: ContactCreate, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Create a new contact."""
    try:
        return contacts_service.create_contact(db, data, user_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/search")
async def search_contacts(q: str = Query(..., min_length=1), db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Search contacts by name, phone, or email."""
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(
        WhatsappSession.user_id == user_id, WhatsappSession.status == SessionStatus.connected
    ).first()
    wa_account = session.phone if session else None
    result = contacts_service.get_contacts(db, user_id, search=q, limit=10, wa_account=wa_account)
    return result["contacts"]


@router.post("/sync")
async def sync_contacts(background_tasks: BackgroundTasks, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Start a background contact sync and return immediately.
    Poll GET /contacts/sync-progress?user_id=<id> for live progress."""
    from database.connection import SessionLocal

    def _run_sync():
        bg_db = SessionLocal()
        try:
            contacts_service.sync_whatsapp_contacts(bg_db, user_id)
        except Exception:
            pass
        finally:
            bg_db.close()

    background_tasks.add_task(_run_sync)
    return {"success": True, "message": "Sync started — poll /contacts/sync-progress for updates.", "user_id": user_id}


@router.get("/sync-progress")
async def sync_progress(request: Request, user_id: int = Query(...), ticket: str = Query(...)):
    """SSE endpoint — streams contact sync progress in real time.
    Public (EventSource can't send auth headers), so the caller passes a
    short-lived, stream-scoped ticket (GET /auth/stream-ticket) instead of
    the main JWT."""
    from services.auth_service import user_id_from_stream_ticket
    if user_id_from_stream_ticket(ticket) != user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired stream ticket")

    async def generator():
        while True:
            if await request.is_disconnected():
                return
            state = contacts_service.get_sync_progress(user_id)
            yield f"data: {json.dumps(state)}\n\n"
            if state.get("status") in ("complete", "error"):
                return
            await asyncio.sleep(0.4)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/export")
async def export_contacts(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Export contacts for the active WhatsApp account as a CSV file."""
    import csv, io
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(
        WhatsappSession.user_id == user_id, WhatsappSession.status == SessionStatus.connected
    ).first()
    wa_account = session.phone if session else None

    query = db.query(Contact).filter(Contact.user_id == user_id, Contact.is_active == True, Contact.is_valid == True)
    if wa_account:
        query = query.filter(Contact.wa_account == wa_account)
    contacts = query.order_by(Contact.name).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["name", "phone", "email", "notes", "tags"])
    for c in contacts:
        tags_str = ",".join(c.tags or [])
        writer.writerow([c.name, c.phone, c.email or "", c.notes or "", tags_str])
    csv_bytes = output.getvalue().encode("utf-8-sig")
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"}
    )


@router.post("/import")
async def import_contacts(file: UploadFile = File(...), db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Import contacts from a CSV file (columns: name, phone, email, notes, tags).
    Contacts are assigned to the currently connected WhatsApp account so they
    appear immediately in the contacts list."""
    import csv, io
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(
        WhatsappSession.user_id == user_id, WhatsappSession.status == SessionStatus.connected
    ).first()
    wa_account = session.phone if session else None

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    created = updated = skipped = 0
    errors = []
    for row in reader:
        name = (row.get("name") or row.get("Name") or row.get("Full Name") or "").strip()
        phone = (row.get("phone") or row.get("Phone") or row.get("Mobile") or row.get("mobile") or "").strip()
        email = (row.get("email") or row.get("Email") or "").strip() or None
        notes = (row.get("notes") or row.get("Notes") or "").strip() or None
        tags_raw = (row.get("tags") or row.get("Tags") or "").strip()
        tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else None
        if not name or not phone:
            skipped += 1
            continue
        try:
            existing = db.query(Contact).filter(Contact.phone == phone, Contact.user_id == user_id).first()
            if existing:
                existing.name = name
                if email: existing.email = email
                if notes: existing.notes = notes
                if tags: existing.tags = tags
                if wa_account: existing.wa_account = wa_account
                db.commit()
                updated += 1
            else:
                c = Contact(user_id=user_id, name=name, phone=phone, email=email, notes=notes,
                            tags=tags, wa_account=wa_account)
                db.add(c)
                db.commit()
                db.refresh(c)
                contacts_service.fire_contact_event(db, user_id, wa_account, "contact_added", {
                    "contact_id": c.id, "phone": c.phone, "name": c.name,
                })
                created += 1
        except Exception as e:
            db.rollback()
            errors.append(f"{phone}: {str(e)}")
            skipped += 1
    return {
        "success": True,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:10],
        "message": f"Import complete — {created} added, {updated} updated, {skipped} skipped."
    }


@router.get("/chats")
def get_whatsapp_chats(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get real-time WhatsApp chat list (with last message + unread count) from bridge."""
    from services.whatsapp_service import bridge_url
    try:
        import httpx
        r = httpx.get(bridge_url(user_id, "/chats"), timeout=15.0)
        if r.status_code != 200:
            return {"success": False, "chats": []}
        return r.json()
    except Exception:
        return {"success": False, "chats": []}


def _bridge(user_id, path, method="get", **kwargs):
    from services.whatsapp_service import bridge_url
    import httpx
    fn = getattr(httpx, method)
    try:
        r = fn(bridge_url(user_id, path), timeout=20.0, **kwargs)
        return r.json()
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/group/create")
def group_create(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/create", "post", json=data)


@router.post("/group/add-members")
def group_add_members(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/add-members", "post", json=data)


@router.post("/group/remove-member")
def group_remove_member(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/remove-member", "post", json=data)


@router.post("/group/promote")
def group_promote(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/promote", "post", json=data)


@router.post("/group/demote")
def group_demote(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/demote", "post", json=data)


@router.post("/group/rename")
def group_rename(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/rename", "post", json=data)


@router.post("/group/set-description")
def group_set_description(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/set-description", "post", json=data)


@router.get("/group/invite-link")
def group_invite_link(groupId: str = Query(...), user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/invite-link", params={"groupId": groupId})


@router.post("/group/leave")
def group_leave(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/group/leave", "post", json=data)


@router.get("/status/list")
def status_list(user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/status/list")


@router.post("/status/post")
def status_post(data: dict, user_id: int = Depends(current_user_id)):
    return _bridge(user_id, "/status/post", "post", json=data)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(contact_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get a single contact by ID."""
    contact = contacts_service.get_contact_by_id(db, contact_id, user_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(contact_id: int, data: ContactUpdate, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Update a contact."""
    contact = contacts_service.update_contact(db, contact_id, data, user_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.delete("/{contact_id}")
async def delete_contact(contact_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Delete a contact."""
    deleted = contacts_service.delete_contact(db, contact_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"success": True, "message": "Contact deleted"}


@router.get("/{contact_id}/group-members")
def get_group_members(contact_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get group participants from WhatsApp bridge for a group contact."""
    contact = contacts_service.get_contact_by_id(db, contact_id, user_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    from services.whatsapp_service import bridge_url
    try:
        import httpx
        r = httpx.get(
            bridge_url(user_id, "/group-members"),
            params={"groupId": contact.phone},
            timeout=10.0
        )
        return r.json()
    except Exception as e:
        return {"success": False, "error": str(e), "members": []}


@router.get("/{contact_id}/profile-pic")
def get_profile_pic(contact_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Return contact profile picture URL, using cached DB value when available."""
    from services.whatsapp_service import bridge_url
    contact = contacts_service.get_contact_by_id(db, contact_id, user_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Return cached URL immediately (no bridge round-trip needed)
    if contact.profile_pic_url:
        return {"url": contact.profile_pic_url, "phone": contact.phone, "cached": True}

    try:
        import httpx
        r = httpx.get(bridge_url(user_id, "/profile-pic"), params={"phone": contact.phone}, timeout=8.0)
        url = r.json().get("url") if r.status_code == 200 else None
        if url:
            contact.profile_pic_url = url
            db.add(contact)
            db.commit()
        return {"url": url, "phone": contact.phone, "cached": False}
    except Exception:
        return {"url": None, "phone": contact.phone, "cached": False}
