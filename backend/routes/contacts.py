"""
Contacts Routes — Full CRUD with search and filtering
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import contacts_service
from models.schemas import ContactCreate, ContactUpdate, ContactResponse, ContactListResponse
from models.models import Contact

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=ContactListResponse)
async def list_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    wa_account: Optional[str] = Query(None),
    saved_only: bool = Query(False, description="When true, return only address-book contacts"),
    db: Session = Depends(get_db)
):
    """List contacts with pagination and optional search."""
    if not wa_account:
        from models.models import WhatsappSession, SessionStatus
        session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
        if session:
            wa_account = session.phone

    return contacts_service.get_contacts(
        db, page=page, limit=limit, search=search,
        is_active=is_active, wa_account=wa_account, saved_only=saved_only
    )


@router.post("", response_model=ContactResponse, status_code=201)
async def create_contact(data: ContactCreate, db: Session = Depends(get_db)):
    """Create a new contact."""
    try:
        return contacts_service.create_contact(db, data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/search")
async def search_contacts(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Search contacts by name, phone, or email."""
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
    wa_account = session.phone if session else None
    result = contacts_service.get_contacts(db, search=q, limit=10, wa_account=wa_account)
    return result["contacts"]


@router.post("/sync")
async def sync_contacts(db: Session = Depends(get_db)):
    """Sync contacts from the connected WhatsApp session."""
    try:
        return contacts_service.sync_whatsapp_contacts(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export")
async def export_contacts(db: Session = Depends(get_db)):
    """Export contacts for the active WhatsApp account as a CSV file."""
    import csv, io
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
    wa_account = session.phone if session else None

    query = db.query(Contact).filter(Contact.is_active == True, Contact.is_valid == True)
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
async def import_contacts(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import contacts from a CSV file (columns: name, phone, email, notes, tags).
    Contacts are assigned to the currently connected WhatsApp account so they
    appear immediately in the contacts list."""
    import csv, io
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
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
            existing = db.query(Contact).filter(Contact.phone == phone).first()
            if existing:
                existing.name = name
                if email: existing.email = email
                if notes: existing.notes = notes
                if tags: existing.tags = tags
                if wa_account: existing.wa_account = wa_account
                db.commit()
                updated += 1
            else:
                c = Contact(name=name, phone=phone, email=email, notes=notes,
                            tags=tags, wa_account=wa_account)
                db.add(c)
                db.commit()
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
def get_whatsapp_chats(db: Session = Depends(get_db)):
    """Get real-time WhatsApp chat list (with last message + unread count) from bridge."""
    from config.settings import settings
    try:
        import httpx
        r = httpx.get(f"{settings.BRIDGE_URL}/chats", timeout=15.0)
        if r.status_code != 200:
            return {"success": False, "chats": []}
        return r.json()
    except Exception:
        return {"success": False, "chats": []}


def _bridge(path, method="get", **kwargs):
    from config.settings import settings
    import httpx
    fn = getattr(httpx, method)
    try:
        r = fn(f"{settings.BRIDGE_URL}{path}", timeout=20.0, **kwargs)
        return r.json()
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/group/create")
def group_create(data: dict):
    return _bridge("/group/create", "post", json=data)


@router.post("/group/add-members")
def group_add_members(data: dict):
    return _bridge("/group/add-members", "post", json=data)


@router.post("/group/remove-member")
def group_remove_member(data: dict):
    return _bridge("/group/remove-member", "post", json=data)


@router.post("/group/promote")
def group_promote(data: dict):
    return _bridge("/group/promote", "post", json=data)


@router.post("/group/demote")
def group_demote(data: dict):
    return _bridge("/group/demote", "post", json=data)


@router.post("/group/rename")
def group_rename(data: dict):
    return _bridge("/group/rename", "post", json=data)


@router.post("/group/set-description")
def group_set_description(data: dict):
    return _bridge("/group/set-description", "post", json=data)


@router.get("/group/invite-link")
def group_invite_link(groupId: str = Query(...)):
    return _bridge("/group/invite-link", params={"groupId": groupId})


@router.post("/group/leave")
def group_leave(data: dict):
    return _bridge("/group/leave", "post", json=data)


@router.get("/status/list")
def status_list():
    return _bridge("/status/list")


@router.post("/status/post")
def status_post(data: dict):
    return _bridge("/status/post", "post", json=data)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(contact_id: int, db: Session = Depends(get_db)):
    """Get a single contact by ID."""
    contact = contacts_service.get_contact_by_id(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(contact_id: int, data: ContactUpdate, db: Session = Depends(get_db)):
    """Update a contact."""
    contact = contacts_service.update_contact(db, contact_id, data)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.delete("/{contact_id}")
async def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    """Delete a contact."""
    deleted = contacts_service.delete_contact(db, contact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"success": True, "message": "Contact deleted"}


@router.get("/{contact_id}/group-members")
def get_group_members(contact_id: int, db: Session = Depends(get_db)):
    """Get group participants from WhatsApp bridge for a group contact."""
    contact = contacts_service.get_contact_by_id(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    from config.settings import settings
    try:
        import httpx
        r = httpx.get(
            f"{settings.BRIDGE_URL}/group-members",
            params={"groupId": contact.phone},
            timeout=10.0
        )
        return r.json()
    except Exception as e:
        return {"success": False, "error": str(e), "members": []}


@router.get("/{contact_id}/profile-pic")
def get_profile_pic(contact_id: int, db: Session = Depends(get_db)):
    """Proxy request to WhatsApp bridge to get contact profile picture URL."""
    from config.settings import settings
    contact = contacts_service.get_contact_by_id(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    try:
        import httpx
        r = httpx.get(
            f"{settings.BRIDGE_URL}/profile-pic",
            params={"phone": contact.phone},
            timeout=8.0
        )
        data = r.json()
        return {"url": data.get("url"), "phone": contact.phone}
    except Exception:
        return {"url": None, "phone": contact.phone}
