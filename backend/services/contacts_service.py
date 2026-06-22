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
    is_active: Optional[bool] = None
) -> dict:
    """List contacts with pagination and search."""
    query = db.query(Contact)

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


def create_contact(db: Session, data: ContactCreate) -> Contact:
    existing = get_contact_by_phone(db, data.phone)
    if existing:
        raise ValueError(f"Contact with phone {data.phone} already exists")

    contact = Contact(
        name=data.name,
        phone=data.phone,
        email=data.email,
        notes=data.notes,
        tags=data.tags,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    logger.info(f"Created contact: {contact.name} ({contact.phone})")
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


def get_total_contacts(db: Session) -> int:
    return db.query(func.count(Contact.id)).scalar() or 0


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
            r = httpx.get("http://localhost:3000/contacts", timeout=20.0)
            if r.status_code != 200:
                raise Exception(f"Bridge returned status code {r.status_code}")
                
            res_data = r.json()
            wa_contacts = res_data.get("contacts", [])
            
            synced_count = 0
            for wc in wa_contacts:
                phone = wc["phone"]
                name = wc["name"]
                
                # Check if contact already exists
                existing = db.query(Contact).filter(Contact.phone == phone).first()
                if existing:
                    # Update name if it changed
                    if existing.name != name:
                        existing.name = name
                        db.add(existing)
                        synced_count += 1
                else:
                    # Insert new contact
                    contact = Contact(name=name, phone=phone, is_active=True)
                    db.add(contact)
                    synced_count += 1
                    
            db.commit()
            return {"success": True, "message": f"Successfully synced {synced_count} contacts from your phone."}
        except Exception as e:
            logger.error(f"Failed to sync contacts from bridge: {e}")
            raise Exception(f"Failed to sync contacts: {str(e)}")
            
    else:
        raise ValueError(f"Unknown connection type: {connection_type}")
