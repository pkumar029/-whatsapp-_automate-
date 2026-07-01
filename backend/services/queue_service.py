"""
Queue Service — campaigns creation, variables interpolation, lock processing, exponential backoffs, concurrency, and delay spacing.
"""
import logging
import re
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from models.models import (
    Campaign, MessageJob, CampaignStatus, JobStatus,
    Contact, Message, MessageDirection, MessageStatus, SessionStatus
)
from models.schemas import CampaignCreate
from services import whatsapp_service

logger = logging.getLogger(__name__)


def create_campaign(db: Session, data: CampaignCreate, wa_account: Optional[str] = None) -> Campaign:
    """Create a new Campaign and schedule message jobs for each contact with variable templates."""
    # Validate contacts list
    if not data.contacts:
        raise ValueError("At least one contact must be selected")

    contacts = db.query(Contact).filter(Contact.id.in_(data.contacts)).all()
    if len(contacts) != len(data.contacts):
        found_ids = [c.id for c in contacts]
        missing_ids = list(set(data.contacts) - set(found_ids))
        raise ValueError(f"Contacts not found for IDs: {missing_ids}")

    # Create Campaign record
    campaign = Campaign(
        name=data.name,
        wa_account=wa_account,
        status=CampaignStatus.active,
        delay_seconds=data.delay_seconds or 0,
        concurrency=data.concurrency or 1,
        total_jobs=len(contacts),
        completed_jobs=0,
        failed_jobs=0,
    )
    db.add(campaign)
    db.flush()  # Get campaign.id

    # Create Message Jobs
    base_time = data.scheduled_at
    if base_time.tzinfo is not None:
        base_time = base_time.replace(tzinfo=None)

    for i, contact in enumerate(contacts):
        # Render template variables
        body = data.template
        # Standard variables
        body = body.replace("{{name}}", contact.name)
        body = body.replace("{{phone}}", contact.phone)
        body = body.replace("{{email}}", contact.email or "")
        body = body.replace("{{notes}}", contact.notes or "")
        
        # Stagger scheduled time by index * delay_seconds
        staggered_time = base_time + timedelta(seconds=i * campaign.delay_seconds)

        job = MessageJob(
            campaign_id=campaign.id,
            contact_id=contact.id,
            phone=contact.phone,
            body=body,
            scheduled_at=staggered_time,
            status=JobStatus.queued,
            retry_count=0
        )
        db.add(job)

    db.commit()
    db.refresh(campaign)
    return campaign


def process_due_jobs(db: Session):
    """Scan and process due jobs in the queue, respecting concurrency and delays."""
    now = datetime.utcnow()
    
    # 1. Fetch active campaigns to verify status
    active_campaigns = db.query(Campaign).filter(Campaign.status == CampaignStatus.active).all()
    active_campaign_ids = [c.id for c in active_campaigns]
    
    # If no active campaigns and no direct scheduled jobs, nothing to do
    # But note: we also support campaign_id == None (one-off scheduled messages)
    
    # 2. Get currently active sending jobs per campaign for concurrency tracking
    active_sends = db.query(
        MessageJob.campaign_id, func.count(MessageJob.id)
    ).filter(
        MessageJob.status == JobStatus.sending,
        MessageJob.campaign_id != None
    ).group_by(MessageJob.campaign_id).all()
    active_send_map = {c_id: count for c_id, count in active_sends}

    # 3. Get last sent time per campaign for delay spacing tracking
    # We only care about campaigns with delay_seconds > 0
    last_sent_times = {}
    for campaign in active_campaigns:
        if campaign.delay_seconds > 0:
            last_job = db.query(MessageJob).filter(
                MessageJob.campaign_id == campaign.id,
                MessageJob.status == JobStatus.sent
            ).order_by(desc(MessageJob.sent_time)).first()
            if last_job and last_job.sent_time:
                last_sent_times[campaign.id] = last_job.sent_time

    # 4. Fetch candidate due jobs
    # A job is due if:
    # - status is queued
    # - scheduled_at <= now OR next_retry_time <= now
    # - lock_time IS NULL OR lock_time < now - 5 minutes (stuck lock recovery)
    lock_expiry = now - timedelta(minutes=5)
    due_jobs_query = db.query(MessageJob).filter(
        MessageJob.status == JobStatus.queued,
        or_(
            MessageJob.scheduled_at <= now,
            MessageJob.next_retry_time <= now
        ),
        or_(
            MessageJob.lock_time == None,
            MessageJob.lock_time < lock_expiry
        )
    )

    # Filter to only active campaigns or direct (campaign_id is NULL) jobs
    if active_campaign_ids:
        due_jobs_query = due_jobs_query.filter(
            or_(
                MessageJob.campaign_id == None,
                MessageJob.campaign_id.in_(active_campaign_ids)
            )
        )
    else:
        due_jobs_query = due_jobs_query.filter(MessageJob.campaign_id == None)

    # Limit page to process in one tick
    due_jobs = due_jobs_query.order_by(MessageJob.scheduled_at.asc()).limit(50).all()

    if not due_jobs:
        return

    # Check WhatsApp connection health before starting any job delivery
    session_status = whatsapp_service.get_session_status(db)
    is_session_connected = (session_status.get("status") == "connected")

    for job in due_jobs:
        # Respect Campaign Concurrency & Delay
        if job.campaign_id:
            campaign = db.query(Campaign).filter(Campaign.id == job.campaign_id).first()
            if not campaign or campaign.status != CampaignStatus.active:
                continue

            # Check Concurrency Limit
            current_sends = active_send_map.get(job.campaign_id, 0)
            if current_sends >= campaign.concurrency:
                logger.debug(f"Campaign {campaign.id} concurrency limit reached ({current_sends}/{campaign.concurrency}). Skipping job {job.id}.")
                continue

            # Check Delay Spacing Limit
            last_sent = last_sent_times.get(job.campaign_id)
            if last_sent:
                elapsed = (now - last_sent).total_seconds()
                if elapsed < campaign.delay_seconds:
                    logger.debug(f"Campaign {campaign.id} delay spacing active (elapsed {elapsed:.1f}s < {campaign.delay_seconds}s). Skipping job {job.id}.")
                    continue

        # Check WhatsApp connectivity. If not connected, we keep job as queued, clear lock, and exit processing
        if not is_session_connected:
            logger.warning("WhatsApp session is offline. Skipping job execution to avoid false sent records.")
            # Clear lock just in case it was a stuck lock recovery
            if job.lock_time:
                job.lock_time = None
                db.commit()
            break

        # Acquire pessimistic lock on the individual job
        locked_job = db.query(MessageJob).filter(
            MessageJob.id == job.id,
            MessageJob.status == JobStatus.queued
        ).with_for_update(skip_locked=True).first()

        if not locked_job:
            continue

        # Mark job as sending immediately to prevent other workers from selecting it
        locked_job.status = JobStatus.sending
        locked_job.lock_time = datetime.utcnow()
        db.commit()

        # Update local concurrency map
        if job.campaign_id:
            active_send_map[job.campaign_id] = active_send_map.get(job.campaign_id, 0) + 1

        # Process send
        logger.info(f"Processing job {job.id} to phone {job.phone}")
        try:
            res = whatsapp_service.send_whatsapp_message(db, job.phone, job.body)
            
            # Send Success: mark job as sent
            locked_job.status = JobStatus.sent
            locked_job.sent_time = datetime.utcnow()
            locked_job.provider_id = res.get("message_id")
            locked_job.lock_time = None
            locked_job.failure_reason = None
            
            # Save message in regular chat history
            msg = Message(
                contact_id=job.contact_id,
                phone=job.phone,
                direction=MessageDirection.outbound,
                content=job.body,
                status=MessageStatus.sent,
                whatsapp_message_id=res.get("message_id"),
                sent_at=datetime.utcnow()
            )
            db.add(msg)
            
            # Update campaign counters
            if job.campaign_id:
                campaign = db.query(Campaign).filter(Campaign.id == job.campaign_id).first()
                if campaign:
                    campaign.completed_jobs += 1
                    # Update last sent time
                    last_sent_times[campaign.id] = locked_job.sent_time

            logger.info(f"Job {job.id} sent successfully")

        except Exception as e:
            err_msg = str(e)
            logger.error(f"Failed to send job {job.id}: {err_msg}")
            
            # Determine if error is permanent (like invalid number format or unregistered)
            is_permanent = "invalid" in err_msg.lower() or "not registered" in err_msg.lower() or "format" in err_msg.lower()
            
            if is_permanent or locked_job.retry_count >= 3:
                # Permanent failure
                locked_job.status = JobStatus.failed
                locked_job.failure_reason = err_msg
                locked_job.lock_time = None
                
                # Save failed record in chat history
                msg = Message(
                    contact_id=job.contact_id,
                    phone=job.phone,
                    direction=MessageDirection.outbound,
                    content=job.body,
                    status=MessageStatus.failed,
                    error_message=err_msg
                )
                db.add(msg)
                
                if job.campaign_id:
                    campaign = db.query(Campaign).filter(Campaign.id == job.campaign_id).first()
                    if campaign:
                        campaign.failed_jobs += 1
            else:
                # Temporary failure: schedule retry with exponential backoff
                locked_job.retry_count += 1
                backoff_seconds = (2 ** locked_job.retry_count) * 30
                locked_job.next_retry_time = datetime.utcnow() + timedelta(seconds=backoff_seconds)
                locked_job.status = JobStatus.queued
                locked_job.lock_time = None
                logger.info(f"Job {job.id} failed temporarily. Scheduled retry #{locked_job.retry_count} at {locked_job.next_retry_time}")

        # Update Campaign progress state (completed / active)
        if job.campaign_id:
            campaign = db.query(Campaign).filter(Campaign.id == job.campaign_id).first()
            if campaign and (campaign.completed_jobs + campaign.failed_jobs >= campaign.total_jobs):
                campaign.status = CampaignStatus.completed
                logger.info(f"Campaign {campaign.id} completed. Total: {campaign.total_jobs}, Completed: {campaign.completed_jobs}, Failed: {campaign.failed_jobs}")

        db.commit()


def cron_matches(cron_expr: str, dt: datetime) -> bool:
    """Evaluate pure-python cron matching for 5-field and 6-field formats."""
    parts = cron_expr.strip().split()
    if len(parts) == 6:
        min_, hr, day, month, dow = parts[1:6]
    elif len(parts) == 5:
        min_, hr, day, month, dow = parts
    else:
        return False
        
    def field_matches(field: str, val: int) -> bool:
        if field == '*':
            return True
        if ',' in field:
            return any(field_matches(f, val) for f in field.split(','))
        if '/' in field:
            lhs, rhs = field.split('/')
            step = int(rhs)
            if lhs == '*':
                return val % step == 0
            if '-' in lhs:
                start, end = map(int, lhs.split('-'))
                return start <= val <= end and (val - start) % step == 0
            return val % step == 0
        if '-' in field:
            start, end = map(int, field.split('-'))
            return start <= val <= end
        return int(field) == val

    # Align python weekday (0=Monday, 6=Sunday) to cron DOW (0=Sunday, 1=Monday, ..., 6=Saturday)
    cron_dow_val = (dt.weekday() + 1) % 7
    
    try:
        return (
            field_matches(min_, dt.minute) and
            field_matches(hr, dt.hour) and
            field_matches(day, dt.day) and
            field_matches(month, dt.month) and
            (field_matches(dow, cron_dow_val) or (dow == '7' and cron_dow_val == 0))
        )
    except Exception:
        return False


def process_scheduled_automations(db: Session, now: datetime):
    """Scan active schedule automations and trigger runs if the cron expression matches."""
    from models.models import Automation, TriggerType
    from services.automation_runner import run_automation
    import threading
    
    try:
        active_schedules = db.query(Automation).filter(
            Automation.is_active == True,
            Automation.trigger_type == TriggerType.schedule
        ).all()
        
        for automation in active_schedules:
            config = automation.trigger_config or {}
            cron_expr = config.get("cron")
            if not cron_expr:
                continue
                
            if cron_matches(cron_expr, now):
                logger.info(f"Triggering scheduled automation '{automation.name}' (ID: {automation.id}) via cron: {cron_expr}")
                
                # Execute run in a separate thread to prevent blocking the queue worker
                def run_bg(auto_id):
                    from database.connection import SessionLocal
                    bg_db = SessionLocal()
                    try:
                        run_automation(bg_db, auto_id, {"trigger": "schedule"})
                    except Exception as e:
                        logger.error(f"Scheduled automation {auto_id} background run failed: {e}")
                    finally:
                        bg_db.close()
                        
                t = threading.Thread(target=run_bg, args=(automation.id,))
                t.daemon = True
                t.start()
                
    except Exception as e:
        logger.error(f"Failed to process scheduled automations: {e}", exc_info=True)


async def run_queue_worker_loop():
    """Async loop that ticks every 5 s; heavy DB/HTTP work runs in a thread
    so the event loop is never blocked."""
    from database.connection import SessionLocal
    loop = asyncio.get_event_loop()
    logger.info("Queue worker background loop started.")
    last_cron_check: list = [None]   # list so the nested fn can mutate it

    def _tick():
        from database.connection import SessionLocal as _SL
        with _SL() as db:
            process_due_jobs(db)
            now = datetime.utcnow()
            current_min = now.replace(second=0, microsecond=0)
            if last_cron_check[0] is None or current_min > last_cron_check[0]:
                last_cron_check[0] = current_min
                process_scheduled_automations(db, now)

    while True:
        try:
            await loop.run_in_executor(None, _tick)
        except Exception as err:
            logger.error(f"Error in queue worker loop iteration: {err}", exc_info=True)
        await asyncio.sleep(5)
