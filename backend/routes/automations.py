"""
Automations Routes — CRUD, steps, activate/deactivate, run
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import automations_service
from services.automation_runner import run_automation
from models.schemas import AutomationCreate, AutomationUpdate, AutomationListResponse

router = APIRouter(prefix="/automations", tags=["Automations"])


@router.get("", response_model=AutomationListResponse)
async def list_automations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return automations_service.get_automations(db, page=page, limit=limit, search=search)


@router.post("", status_code=201)
async def create_automation(data: AutomationCreate, db: Session = Depends(get_db)):
    try:
        automation = automations_service.create_automation(db, data)
        return {"success": True, "id": automation.id, "name": automation.name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{automation_id}")
async def get_automation(automation_id: int, db: Session = Depends(get_db)):
    automation = automations_service.get_automation_by_id(db, automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation


@router.put("/{automation_id}")
async def update_automation(automation_id: int, data: AutomationUpdate, db: Session = Depends(get_db)):
    automation = automations_service.update_automation(db, automation_id, data)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "id": automation.id}


@router.delete("/{automation_id}")
async def delete_automation(automation_id: int, db: Session = Depends(get_db)):
    deleted = automations_service.delete_automation(db, automation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "message": "Automation deleted"}


@router.post("/{automation_id}/activate")
async def activate(automation_id: int, db: Session = Depends(get_db)):
    result = automations_service.activate_automation(db, automation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "is_active": True}


@router.post("/{automation_id}/deactivate")
async def deactivate(automation_id: int, db: Session = Depends(get_db)):
    result = automations_service.deactivate_automation(db, automation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "is_active": False}


@router.post("/{automation_id}/run")
async def run_now(automation_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger an automation run immediately (runs in background)."""
    automation = automations_service.get_automation_by_id(db, automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    background_tasks.add_task(run_automation, db, automation_id, {"trigger": "manual"})
    return {"success": True, "message": f"Automation '{automation.name}' triggered"}


@router.get("/{automation_id}/steps")
async def get_steps(automation_id: int, db: Session = Depends(get_db)):
    automation = automations_service.get_automation_by_id(db, automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation.steps
