"""
Automations Routes — CRUD, steps, activate/deactivate, run
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db, SessionLocal
from services import automations_service
from services.automation_runner import run_automation
from models.schemas import AutomationCreate, AutomationUpdate, AutomationListResponse, StepSchema
from models.models import TriggerType
from dependencies import current_user_id

router = APIRouter(prefix="/automations", tags=["Automations"])


def _active_wa_account(db: Session, user_id: int) -> Optional[str]:
    from models.models import WhatsappSession, SessionStatus as SS
    session = db.query(WhatsappSession).filter(WhatsappSession.user_id == user_id, WhatsappSession.status == SS.connected).first()
    return session.phone if session else None


@router.get("", response_model=AutomationListResponse)
async def list_automations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    wa_account: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    if not wa_account:
        wa_account = _active_wa_account(db, user_id)
    return automations_service.get_automations(db, user_id, page=page, limit=limit, search=search, wa_account=wa_account)


@router.post("", status_code=201)
async def create_automation(data: AutomationCreate, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    try:
        wa_account = _active_wa_account(db, user_id)
        automation = automations_service.create_automation(db, data, user_id, wa_account=wa_account)
        return {"success": True, "id": automation.id, "name": automation.name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{automation_id}")
async def get_automation(automation_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    automation = automations_service.get_automation_by_id(db, automation_id, user_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation


@router.put("/{automation_id}")
async def update_automation(automation_id: int, data: AutomationUpdate, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    automation = automations_service.update_automation(db, automation_id, data, user_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "id": automation.id}


@router.delete("/{automation_id}")
async def delete_automation(automation_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    deleted = automations_service.delete_automation(db, automation_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "message": "Automation deleted"}


@router.post("/{automation_id}/activate")
async def activate(automation_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    result = automations_service.activate_automation(db, automation_id, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "is_active": True}


@router.post("/{automation_id}/deactivate")
async def deactivate(automation_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    result = automations_service.deactivate_automation(db, automation_id, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "is_active": False}


@router.post("/{automation_id}/run")
async def run_now(
    automation_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
    dry_run: bool = Query(False, description="Simulate without sending real messages"),
):
    """Trigger an automation run immediately. Pass dry_run=true to simulate without sending."""
    automation = automations_service.get_automation_by_id(db, automation_id, user_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    name = automation.name

    if dry_run:
        # Execute synchronously and return simulation result
        result = run_automation(db, automation_id, {"trigger": "manual_dry_run"}, dry_run=True)
        return {
            "success": True,
            "dry_run": True,
            "steps_simulated": result.steps_executed,
            "log_output": result.log_output,
            "status": result.status.value if result.status else "unknown",
            "execution_time_ms": result.execution_time,
        }

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


@router.get("/{automation_id}/history")
async def get_history(
    automation_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """Return recent run logs for a specific automation."""
    automation = automations_service.get_automation_by_id(db, automation_id, user_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    from models.models import AutomationLog
    from sqlalchemy import desc
    logs = (
        db.query(AutomationLog)
        .filter(AutomationLog.automation_id == automation_id)
        .order_by(desc(AutomationLog.started_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "status": l.status.value if l.status else "unknown",
            "steps_executed": l.steps_executed,
            "total_steps": l.total_steps,
            "execution_time": l.execution_time,
            "started_at": l.started_at,
            "finished_at": l.finished_at,
            "error_message": l.error_message,
            "log_output": l.log_output,
            "trigger_data": l.trigger_data,
        }
        for l in logs
    ]


@router.post("/{automation_id}/duplicate", status_code=201)
async def duplicate_automation(automation_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Duplicate an automation and all its steps."""
    src = automations_service.get_automation_by_id(db, automation_id, user_id)
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
    new_auto = automations_service.create_automation(db, copy_data, user_id)
    return {"success": True, "id": new_auto.id, "name": new_auto.name}


@router.post("/{automation_id}/webhook-trigger")
async def webhook_trigger(automation_id: int, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """External systems can POST here to trigger a webhook_received automation.
    Requires the owner's JWT like every other route now that auth is real —
    an anonymous/shared webhook secret would be a separate feature.

    Any JSON body sent is parsed and merged into the run's trigger context, so
    step templates can reference it (e.g. `{{order_id}}`)."""
    automation = automations_service.get_automation_by_id(db, automation_id, user_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    if automation.trigger_type != TriggerType.webhook_received:
        raise HTTPException(status_code=400, detail="This automation is not configured for webhook triggers")
    if not automation.is_active:
        raise HTTPException(status_code=400, detail="Automation is not active")

    try:
        body = await request.json()
        if not isinstance(body, dict):
            body = {}
    except Exception:
        body = {}

    trigger_data = {"trigger": "webhook_received", **body}

    def _bg():
        bg_db = SessionLocal()
        try:
            run_automation(bg_db, automation_id, trigger_data)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Webhook trigger run failed: {e}")
        finally:
            bg_db.close()

    background_tasks.add_task(_bg)
    return {"success": True, "message": f"Automation '{automation.name}' triggered via webhook"}


@router.get("/{automation_id}/steps")
async def get_steps(automation_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    automation = automations_service.get_automation_by_id(db, automation_id, user_id)
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    return automation.steps


@router.post("/{automation_id}/steps", status_code=201)
async def add_step(automation_id: int, data: StepSchema, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Add a single step to an automation."""
    step = automations_service.add_step(db, automation_id, data, user_id)
    if not step:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"success": True, "id": step.id, "step_order": step.step_order}


@router.put("/{automation_id}/steps/{step_id}")
async def update_step(automation_id: int, step_id: int, data: StepSchema, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Update a single automation step."""
    step = automations_service.update_step(db, automation_id, step_id, data, user_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    return {"success": True, "id": step.id}


@router.delete("/{automation_id}/steps/{step_id}")
async def delete_step(automation_id: int, step_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Delete a single automation step."""
    deleted = automations_service.delete_step(db, automation_id, step_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Step not found")
    return {"success": True, "message": "Step deleted"}
