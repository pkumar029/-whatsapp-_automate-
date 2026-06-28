"""
Logs Service — Retrieve and manage automation execution logs
"""
import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.models import AutomationLog, Automation, LogStatus

logger = logging.getLogger(__name__)


def get_logs(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    automation_id: Optional[int] = None,
) -> dict:
    query = db.query(AutomationLog)

    if status:
        query = query.filter(AutomationLog.status == status)
    if automation_id:
        query = query.filter(AutomationLog.automation_id == automation_id)
    if search:
        # Filter by automation name via subquery
        matching_ids = [
            a.id for a in db.query(Automation).filter(Automation.name.ilike(f"%{search}%")).all()
        ]
        query = query.filter(AutomationLog.automation_id.in_(matching_ids))

    total = query.count()
    logs = query.order_by(AutomationLog.started_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for log in logs:
        automation = db.query(Automation).filter(Automation.id == log.automation_id).first()
        item = {
            "id": log.id,
            "automation_id": log.automation_id,
            "automation_name": automation.name if automation else f"Automation #{log.automation_id}",
            "status": log.status.value if log.status else "unknown",
            "log_output": log.log_output,
            "error_message": log.error_message,
            "steps_executed": log.steps_executed,
            "total_steps": log.total_steps,
            "execution_time": log.execution_time,
            "started_at": log.started_at,
            "finished_at": log.finished_at,
            "created_at": log.created_at,
        }
        result.append(item)

    return {"logs": result, "total": total}


def get_log_by_id(db: Session, log_id: int) -> Optional[AutomationLog]:
    return db.query(AutomationLog).filter(AutomationLog.id == log_id).first()


def clear_logs(db: Session) -> int:
    count = db.query(AutomationLog).count()
    db.query(AutomationLog).delete()
    db.commit()
    logger.info(f"Cleared {count} log entries")
    return count
