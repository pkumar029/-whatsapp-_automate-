"""
Contacts Routes — Full CRUD with search and filtering
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import contacts_service
from models.schemas import ContactCreate, ContactUpdate, ContactResponse, ContactListResponse

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=ContactListResponse)
async def list_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """List contacts with pagination and optional search."""
    return contacts_service.get_contacts(db, page=page, limit=limit, search=search, is_active=is_active)


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
    result = contacts_service.get_contacts(db, search=q, limit=10)
    return result["contacts"]


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
