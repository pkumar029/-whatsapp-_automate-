"""
Contacts Service — CRUD, search, filtering, validation
"""
import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from models.models import Contact
from models.schemas import ContactCreate, ContactUpdate

logger = logging.getLogger(__name__)


def get_contacts(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    wa_account: Optional[str] = None,
) -> dict:
    """List contacts with pagination and search.

    If wa_account is provided, returns contacts belonging to that account plus
    contacts with no account set (manually added / legacy records that predate
    the wa_account field).  Contacts strictly belonging to a DIFFERENT account
    are excluded so switching accounts shows a clean view.
    """
    query = db.query(Contact)

    if wa_account:
        query = query.filter(
            or_(Contact.wa_account == wa_account, Contact.wa_account.is_(None))
        )

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Contact.name.ilike(search_term),
                Contact.phone.ilike(search_term),
                Contact.email.ilike(search_term),
            )
        )

    if is_active is not None:
        query = query.filter(Contact.is_active == is_active)

    total = query.count()
    contacts = query.order_by(Contact.name).offset((page - 1) * limit).limit(limit).all()

    return {
        "contacts": contacts,
        "total": total,
        "page": page,
        "limit": limit,
    }


def get_contact_by_id(db: Session, contact_id: int) -> Optional[Contact]:
    return db.query(Contact).filter(Contact.id == contact_id).first()


def get_contact_by_phone(db: Session, phone: str) -> Optional[Contact]:
    return db.query(Contact).filter(Contact.phone == phone).first()


def create_contact(db: Session, data: ContactCreate, wa_account: Optional[str] = None) -> Contact:
    existing = get_contact_by_phone(db, data.phone)
    if existing:
        raise ValueError(f"Contact with phone {data.phone} already exists")

    # Use wa_account from data if provided, otherwise from parameter, otherwise from active session
    resolved_wa_account = data.wa_account or wa_account
    if not resolved_wa_account:
        from models.models import WhatsappSession, SessionStatus
        session = db.query(WhatsappSession).filter(
            WhatsappSession.status == SessionStatus.connected
        ).first()
        resolved_wa_account = session.phone if session else None

    contact = Contact(
        name=data.name,
        phone=data.phone,
        email=data.email,
        notes=data.notes,
        tags=data.tags,
        wa_account=resolved_wa_account,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    logger.info(f"Created contact: {contact.name} ({contact.phone}) for account {resolved_wa_account}")
    return contact


def update_contact(db: Session, contact_id: int, data: ContactUpdate) -> Optional[Contact]:
    contact = get_contact_by_id(db, contact_id)
    if not contact:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contact, key, value)

    db.commit()
    db.refresh(contact)
    logger.info(f"Updated contact ID {contact_id}")
    return contact


def delete_contact(db: Session, contact_id: int) -> bool:
    contact = get_contact_by_id(db, contact_id)
    if not contact:
        return False
    db.delete(contact)
    db.commit()
    logger.info(f"Deleted contact ID {contact_id}")
    return True


def get_total_contacts(db: Session, wa_account: Optional[str] = None) -> int:
    q = db.query(func.count(Contact.id))
    if wa_account:
        q = q.filter(or_(Contact.wa_account == wa_account, Contact.wa_account.is_(None)))
    return q.scalar() or 0


def sync_whatsapp_contacts(db: Session) -> dict:
    """Fetch contacts from the active WhatsApp session and save/update in the database."""
    from services import whatsapp_service
    from models.models import Contact, WhatsappSession, SessionStatus
    
    session = whatsapp_service.get_or_create_session(db)
    if session.status != SessionStatus.connected:
        raise ValueError("WhatsApp session is not connected. Connect first.")
        
    connection_type = session.session_data.get("connection_type") if session.session_data else "dev"
    
    if connection_type == "dev":
        # Simulate syncing contacts in Dev mode by creating a few dummy contacts if empty
        dummy_contacts = [
            {"name": "Alice Smith", "phone": "+919876543210"},
            {"name": "Bob Johnson", "phone": "+919876543211"},
            {"name": "Charlie Brown", "phone": "+919876543212"},
        ]
        count = 0
        for dc in dummy_contacts:
            existing = db.query(Contact).filter(Contact.phone == dc["phone"]).first()
            if not existing:
                contact = Contact(name=dc["name"], phone=dc["phone"], is_active=True)
                db.add(contact)
                count += 1
        db.commit()
        return {"success": True, "message": f"Dev contacts simulated successfully. Synced {count} contacts."}
        
    elif connection_type == "meta":
        return {"success": True, "message": "Meta Cloud API does not support phone contact list sync. Please import contacts manually."}
        
    elif connection_type == "bridge":
        import httpx
        try:
            from config.settings import settings
            r = httpx.get(f"{settings.BRIDGE_URL}/contacts", timeout=30.0)
            if r.status_code != 200:
                raise Exception(f"Bridge returned status {r.status_code}: {r.text[:200]}")

            res_data = r.json()
            wa_contacts = res_data.get("contacts", [])
            total_from_bridge = len(wa_contacts)

            if total_from_bridge == 0:
                raise Exception(
                    "WhatsApp bridge returned 0 contacts. "
                    "Make sure WhatsApp is connected and your phone has contacts. "
                    "Try disconnecting and reconnecting WhatsApp."
                )

            new_count = 0
            updated_count = 0

            for wc in wa_contacts:
                phone = wc.get("phone", "").strip()
                name = wc.get("name", "").strip()
                c_type = wc.get("type", "User")

                if not phone or not name:
                    continue

                # Exclude broadcast lists from sync
                if c_type == "Broadcast":
                    continue

                type_tag = "Group" if c_type == "Group" else None

                existing = db.query(Contact).filter(Contact.phone == phone).first()
                current_phone = session.phone or ""
                if existing:
                    changed = False
                    if existing.name != name:
                        existing.name = name
                        changed = True
                    if existing.wa_account != current_phone:
                        existing.wa_account = current_phone
                        changed = True

                    curr_tags = existing.tags or []
                    if not isinstance(curr_tags, list):
                        curr_tags = []
                    new_tags = [t for t in curr_tags if t not in ["Group", "Team", "User"]]
                    if type_tag:
                        new_tags.append(type_tag)
                    if existing.tags != new_tags:
                        existing.tags = new_tags
                        changed = True

                    if changed:
                        db.add(existing)
                        updated_count += 1
                else:
                    tags = [type_tag] if type_tag else []
                    contact = Contact(name=name, phone=phone, is_active=True, tags=tags, wa_account=current_phone)
                    db.add(contact)
                    new_count += 1

            db.commit()

            total_in_db = db.query(Contact).count()
            parts = []
            if new_count > 0:
                parts.append(f"{new_count} new")
            if updated_count > 0:
                parts.append(f"{updated_count} updated")

            change_str = ", ".join(parts) if parts else "no changes"
            return {
                "success": True,
                "message": (
                    f"Sync complete: {total_from_bridge} contacts from WhatsApp "
                    f"({change_str}). Total in database: {total_in_db}."
                )
            }
        except Exception as e:
            logger.error(f"Failed to sync contacts from bridge: {e}")
            raise Exception(f"Failed to sync contacts: {str(e)}")
            
    else:
        raise ValueError(f"Unknown connection type: {connection_type}")
