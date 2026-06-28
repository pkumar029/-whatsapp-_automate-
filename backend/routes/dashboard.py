"""
Dashboard Routes — Summary statistics
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.connection import get_db
from services import contacts_service, messages_service, automations_service
from models.schemas import DashboardSummary
from models.models import AutomationLog, LogStatus, Campaign, CampaignStatus, MessageJob, JobStatus
from sqlalchemy import func

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(db: Session = Depends(get_db)):
    """Get dashboard summary statistics."""
    from models.models import WhatsappSession, SessionStatus
    session = db.query(WhatsappSession).filter(WhatsappSession.status == SessionStatus.connected).first()
    wa_account = session.phone if session else None

    total_contacts = contacts_service.get_total_contacts(db, wa_account)
    sent_messages = messages_service.get_sent_count(db, wa_account)
    failed_messages = messages_service.get_failed_count(db, wa_account)
    active_automations = automations_service.get_active_automations_count(db)
    
    # Active campaigns and queued message jobs
    active_campaigns = db.query(func.count(Campaign.id)).filter(Campaign.status == CampaignStatus.active).scalar() or 0
    queued_jobs = db.query(func.count(MessageJob.id)).filter(MessageJob.status == JobStatus.queued).scalar() or 0

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
        "active_campaigns": active_campaigns,
        "queued_jobs": queued_jobs,
        "recent_activity": recent_activity,
    }
