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
