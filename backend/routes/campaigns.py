"""
Campaigns Router — Campaigns CRUD, status control, and job queue inspection.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from database.connection import get_db
from models.models import Campaign, MessageJob, CampaignStatus, JobStatus, Contact
from models.schemas import (
    CampaignCreate, CampaignUpdate, CampaignResponse, CampaignListResponse, JobListResponse
)
from services import queue_service
from dependencies import current_user_id

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


def _active_wa_account(db: Session, user_id: int) -> Optional[str]:
    """Return the phone of the currently connected WhatsApp session, or None."""
    from models.models import WhatsappSession, SessionStatus as SS
    session = db.query(WhatsappSession).filter(WhatsappSession.user_id == user_id, WhatsappSession.status == SS.connected).first()
    return session.phone if session else None


@router.post("", response_model=CampaignResponse, status_code=201)
async def create_campaign(data: CampaignCreate, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Create a campaign and bulk schedule message jobs."""
    try:
        wa_account = _active_wa_account(db, user_id)
        return queue_service.create_campaign(db, data, user_id, wa_account=wa_account)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    wa_account: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """List campaigns with pagination, filtered by WhatsApp account."""
    if not wa_account:
        wa_account = _active_wa_account(db, user_id)
    query = db.query(Campaign).filter(Campaign.user_id == user_id)
    if wa_account:
        query = query.filter(Campaign.wa_account == wa_account)
    total = query.count()
    campaigns = query.order_by(Campaign.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"campaigns": campaigns, "total": total}


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get detail progress statistics for a single campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: int, data: CampaignUpdate, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Edit campaign metadata. Not allowed while campaign is active."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == CampaignStatus.active:
        raise HTTPException(status_code=400, detail="Pause the campaign before editing it.")
    if data.name is not None:
        campaign.name = data.name.strip()
    if data.delay_seconds is not None:
        campaign.delay_seconds = data.delay_seconds
    if data.concurrency is not None:
        campaign.concurrency = data.concurrency
    if data.template is not None:
        # Propagate new message body to remaining queued jobs
        db.query(MessageJob).filter(
            MessageJob.campaign_id == campaign_id,
            MessageJob.status == JobStatus.queued
        ).update({MessageJob.body: data.template}, synchronize_session=False)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(campaign_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Delete a campaign and all its jobs. Not allowed while campaign is active."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == CampaignStatus.active:
        raise HTTPException(status_code=400, detail="Cancel the campaign before deleting it.")
    db.query(MessageJob).filter(MessageJob.campaign_id == campaign_id).delete()
    db.delete(campaign)
    db.commit()


@router.post("/{campaign_id}/pause", response_model=CampaignResponse)
async def pause_campaign(campaign_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Pause campaign execution."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == CampaignStatus.active:
        campaign.status = CampaignStatus.paused
        db.commit()
        db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/resume", response_model=CampaignResponse)
async def resume_campaign(campaign_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Resume a paused campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == CampaignStatus.paused:
        campaign.status = CampaignStatus.active
        db.commit()
        db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/cancel", response_model=CampaignResponse)
async def cancel_campaign(campaign_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Cancel a campaign and cancel all pending/sending jobs."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign.status = CampaignStatus.cancelled
    
    # Cancel all queued or sending jobs belonging to this campaign
    db.query(MessageJob).filter(
        MessageJob.campaign_id == campaign_id,
        MessageJob.status.in_([JobStatus.queued, JobStatus.sending])
    ).update(
        {MessageJob.status: JobStatus.cancelled, MessageJob.lock_time: None},
        synchronize_session=False
    )
    
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}/jobs", response_model=JobListResponse)
async def get_campaign_jobs(
    campaign_id: int,
    status: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """List message jobs inside a campaign with filters."""
    owned = db.query(Campaign.id).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not owned:
        raise HTTPException(status_code=404, detail="Campaign not found")
    query = db.query(MessageJob).filter(MessageJob.campaign_id == campaign_id)
    if status:
        query = query.filter(MessageJob.status == status)
    if phone:
        query = query.filter(MessageJob.phone.ilike(f"%{phone}%"))
        
    total = query.count()
    jobs = query.order_by(MessageJob.id.asc()).offset((page - 1) * limit).limit(limit).all()
    
    # Attach contact names
    result = []
    for j in jobs:
        item = j.__dict__.copy()
        item.pop('_sa_instance_state', None)
        if j.contact_id:
            contact = db.query(Contact).filter(Contact.id == j.contact_id).first()
            item['contact_name'] = contact.name if contact else None
        else:
            item['contact_name'] = None
        result.append(item)
        
    return {"jobs": result, "total": total}


@router.post("/{campaign_id}/jobs/{job_id}/cancel")
async def cancel_job(campaign_id: int, job_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Cancel an individual queued job."""
    owned = db.query(Campaign.id).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not owned:
        raise HTTPException(status_code=404, detail="Campaign not found")
    job = db.query(MessageJob).filter(
        MessageJob.id == job_id,
        MessageJob.campaign_id == campaign_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status in [JobStatus.queued, JobStatus.sending]:
        job.status = JobStatus.cancelled
        job.lock_time = None
        db.commit()
    return {"success": True, "message": "Job cancelled successfully"}


@router.post("/{campaign_id}/jobs/{job_id}/retry")
async def retry_job(campaign_id: int, job_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Force retry a failed or cancelled message job."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == user_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    job = db.query(MessageJob).filter(
        MessageJob.id == job_id,
        MessageJob.campaign_id == campaign_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = JobStatus.queued
    job.retry_count = 0
    job.next_retry_time = None
    job.lock_time = None
    job.failure_reason = None
    job.scheduled_at = datetime.utcnow()

    # Reactivate the parent campaign if it was completed or cancelled
    if campaign.status in [CampaignStatus.completed, CampaignStatus.cancelled]:
        campaign.status = CampaignStatus.active

    db.commit()
    return {"success": True, "message": "Job scheduled for retry"}
