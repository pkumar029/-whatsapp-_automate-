"""
Automations Routes — CRUD, steps, activate/deactivate, run
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db, SessionLocal
from services import automations_service
from services.automation_runner import run_automation
from models.schemas import AutomationCreate, AutomationUpdate, AutomationListResponse, StepSchema

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
    """Trigger an automation run immediately (runs in background with its own session)."""
    automation = automations_service.get_automation_by_id(db, automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    name = automation.name

    def _bg_run():
        bg_db = SessionLocal()
        try:
            run_automation(bg_db, automation_id, {"trigger": "manual"})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Background automation run failed: {e}")
        finally:
            bg_db.close()

    background_tasks.add_task(_bg_run)
    return {"success": True, "message": f"Automation '{name}' triggered"}


@router.post("/{automation_id}/duplicate", status_code=201)
async def duplicate_automation(automation_id: int, db: Session = Depends(get_db)):
    """Duplicate an automation and all its steps."""
    src = automations_service.get_automation_by_id(db, automation_id)
    if not src:
        raise HTTPException(status_code=404, detail="Automation not found")
    from models.schemas import AutomationCreate, StepSchema
    steps = [
        StepSchema(step_type=s.step_type.value, step_order=s.step_order, name=s.name, config=s.config)
        for s in sorted(src.steps, key=lambda x: x.step_order)
    ]
    copy_data = AutomationCreate(
        name=f"{src.name} (copy)",
        description=src.description,
        trigger_type=src.trigger_type.value,
        trigger_config=src.trigger_config,
        steps=steps,
    )
    new_auto = automations_service.create_automation(db, copy_data)
    return {"success": True, "id": new_auto.id, "name": new_auto.name}


@router.post("/{automation_id}/webhook-trigger")
async def webhook_trigger(automation_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """External systems can POST here to trigger a webhook_received automation."""
    automation = automations_service.get_automation_by_id(db, automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    if not automation.is_active:
        raise HTTPException(status_code=400, detail="Automation is not active")

    def _bg():
        bg_db = SessionLocal()
        try:
            run_automation(bg_db, automation_id, {"trigger": "webhook_received"})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Webhook trigger run failed: {e}")
        finally:
            bg_db.close()

    background_tasks.add_task(_bg)
    return {"success": True, "message": f"Automation '{automation.name}' triggered via webhook"}


@router.get("/{automation_id}/steps")
async def get_steps(automation_id: int, db: Session = Depends(get_db)):
    automation = automations_service.get_automation_by_id(db, automation_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation.steps


@router.post("/{automation_id}/steps", status_code=201)
async def add_step(automation_id: int, data: StepSchema, db: Session = Depends(get_db)):
    """Add a single step to an automation."""
    step = automations_service.add_step(db, automation_id, data)
    if not step:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "id": step.id, "step_order": step.step_order}


@router.put("/{automation_id}/steps/{step_id}")
async def update_step(automation_id: int, step_id: int, data: StepSchema, db: Session = Depends(get_db)):
    """Update a single automation step."""
    step = automations_service.update_step(db, automation_id, step_id, data)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    return {"success": True, "id": step.id}


@router.delete("/{automation_id}/steps/{step_id}")
async def delete_step(automation_id: int, step_id: int, db: Session = Depends(get_db)):
    """Delete a single automation step."""
    deleted = automations_service.delete_step(db, automation_id, step_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Step not found")
    return {"success": True, "message": "Step deleted"}
