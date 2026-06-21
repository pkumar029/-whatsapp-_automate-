"""
Automations Service — CRUD, steps management, status control
"""
import logging
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.models import Automation, AutomationStep, TriggerType, StepType
from models.schemas import AutomationCreate, AutomationUpdate, StepSchema

logger = logging.getLogger(__name__)


def get_automations(db: Session, page: int = 1, limit: int = 20, search: Optional[str] = None) -> dict:
    query = db.query(Automation)
    if search:
        query = query.filter(Automation.name.ilike(f"%{search}%"))
    total = query.count()
    automations = query.order_by(Automation.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for a in automations:
        item = {
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "trigger_type": a.trigger_type.value if a.trigger_type else "manual",
            "trigger_config": a.trigger_config,
            "is_active": a.is_active,
            "run_count": a.run_count,
            "last_run": a.last_run,
            "step_count": len(a.steps),
            "created_at": a.created_at,
            "updated_at": a.updated_at,
        }
        result.append(item)

    return {"automations": result, "total": total}


def get_automation_by_id(db: Session, automation_id: int) -> Optional[Automation]:
    return db.query(Automation).filter(Automation.id == automation_id).first()


def create_automation(db: Session, data: AutomationCreate) -> Automation:
    automation = Automation(
        name=data.name,
        description=data.description,
        trigger_type=TriggerType(data.trigger_type),
        trigger_config=data.trigger_config,
    )
    db.add(automation)
    db.flush()

    if data.steps:
        for i, step_data in enumerate(data.steps):
            step = AutomationStep(
                automation_id=automation.id,
                step_type=StepType(step_data.step_type),
                step_order=step_data.step_order or (i + 1),
                name=step_data.name,
                config=step_data.config,
            )
            db.add(step)

    db.commit()
    db.refresh(automation)
    logger.info(f"Created automation: {automation.name} (ID: {automation.id})")
    return automation


def update_automation(db: Session, automation_id: int, data: AutomationUpdate) -> Optional[Automation]:
    automation = get_automation_by_id(db, automation_id)
    if not automation:
        return None

    update_fields = data.model_dump(exclude_unset=True, exclude={'steps'})
    for key, value in update_fields.items():
        if key == 'trigger_type' and value:
            setattr(automation, key, TriggerType(value))
        else:
            setattr(automation, key, value)

    if data.steps is not None:
        # Replace all steps
        for step in automation.steps:
            db.delete(step)
        db.flush()
        for i, step_data in enumerate(data.steps):
            step = AutomationStep(
                automation_id=automation.id,
                step_type=StepType(step_data.step_type),
                step_order=step_data.step_order or (i + 1),
                name=step_data.name,
                config=step_data.config,
            )
            db.add(step)

    db.commit()
    db.refresh(automation)
    return automation


def delete_automation(db: Session, automation_id: int) -> bool:
    automation = get_automation_by_id(db, automation_id)
    if not automation:
        return False
    db.delete(automation)
    db.commit()
    return True


def activate_automation(db: Session, automation_id: int) -> Optional[Automation]:
    automation = get_automation_by_id(db, automation_id)
    if not automation:
        return None
    automation.is_active = True
    db.commit()
    db.refresh(automation)
    return automation


def deactivate_automation(db: Session, automation_id: int) -> Optional[Automation]:
    automation = get_automation_by_id(db, automation_id)
    if not automation:
        return None
    automation.is_active = False
    db.commit()
    db.refresh(automation)
    return automation


def get_active_automations_count(db: Session) -> int:
    return db.query(func.count(Automation.id)).filter(Automation.is_active == True).scalar() or 0
