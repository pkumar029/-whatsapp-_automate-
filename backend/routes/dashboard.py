"""
Dashboard Routes — Summary statistics
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.connection import get_db
from services import contacts_service, messages_service, automations_service
from models.schemas import DashboardSummary
from models.models import AutomationLog, LogStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(db: Session = Depends(get_db)):
    """Get dashboard summary statistics."""
    total_contacts = contacts_service.get_total_contacts(db)
    sent_messages = messages_service.get_sent_count(db)
    failed_messages = messages_service.get_failed_count(db)
    active_automations = automations_service.get_active_automations_count(db)

    # Recent activity from logs
    recent_logs = db.query(AutomationLog).order_by(
        AutomationLog.started_at.desc()
    ).limit(5).all()

    from models.models import Automation
    recent_activity = []
    for log in recent_logs:
        automation = db.query(Automation).filter(Automation.id == log.automation_id).first()
        elapsed = ""
        if log.started_at:
            from datetime import datetime, timezone
            diff = (datetime.utcnow() - log.started_at).total_seconds()
            if diff < 60:
                elapsed = "Just now"
            elif diff < 3600:
                elapsed = f"{int(diff // 60)}m ago"
            else:
                elapsed = f"{int(diff // 3600)}h ago"

        recent_activity.append({
            "name": automation.name if automation else f"Run #{log.id}",
            "description": f"Steps: {log.steps_executed}/{log.total_steps}",
            "status": log.status.value if log.status else "unknown",
            "time": elapsed,
        })

    return {
        "total_contacts": total_contacts,
        "sent_messages": sent_messages,
        "failed_messages": failed_messages,
        "active_automations": active_automations,
        "recent_activity": recent_activity,
    }
