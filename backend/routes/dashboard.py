"""
Dashboard Routes — Summary statistics
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import contacts_service, messages_service, automations_service
from models.schemas import DashboardSummary
from models.models import AutomationLog, LogStatus, Campaign, CampaignStatus, MessageJob, JobStatus, Automation
from sqlalchemy import func
from dependencies import current_user_id

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    wa_account: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """Get dashboard summary statistics, scoped to the current user (and given WhatsApp account)."""
    if not wa_account:
        from models.models import WhatsappSession, SessionStatus
        session = db.query(WhatsappSession).filter(WhatsappSession.user_id == user_id, WhatsappSession.status == SessionStatus.connected).first()
        wa_account = session.phone if session else None

    total_contacts = contacts_service.get_total_contacts(db, user_id, wa_account)
    sent_messages = messages_service.get_sent_count(db, user_id, wa_account)
    received_messages = messages_service.get_received_count(db, user_id, wa_account)
    failed_messages = messages_service.get_failed_count(db, user_id, wa_account)
    active_automations = automations_service.get_active_automations_count(db, user_id, wa_account)

    # Active campaigns and queued message jobs — scoped to this user
    campaign_q = db.query(func.count(Campaign.id)).filter(Campaign.user_id == user_id, Campaign.status == CampaignStatus.active)
    if wa_account:
        campaign_q = campaign_q.filter(Campaign.wa_account == wa_account)
    active_campaigns = campaign_q.scalar() or 0

    # Queued jobs: join to campaigns so we can scope by user_id/wa_account
    jobs_q = db.query(func.count(MessageJob.id)).join(
        Campaign, MessageJob.campaign_id == Campaign.id
    ).filter(MessageJob.status == JobStatus.queued, Campaign.user_id == user_id)
    if wa_account:
        jobs_q = jobs_q.filter(Campaign.wa_account == wa_account)
    queued_jobs = jobs_q.scalar() or 0

    # Recent activity from logs
    recent_logs = db.query(AutomationLog).join(
        Automation, AutomationLog.automation_id == Automation.id
    ).filter(Automation.user_id == user_id).order_by(
        AutomationLog.started_at.desc()
    ).limit(5).all()

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
        "received_messages": received_messages,
        "failed_messages": failed_messages,
        "active_automations": active_automations,
        "active_campaigns": active_campaigns,
        "queued_jobs": queued_jobs,
        "recent_activity": recent_activity,
    }
