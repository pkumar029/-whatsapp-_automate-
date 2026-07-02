"""
Automation Runner — Execute automation workflows step by step
Handles step execution, error handling, and log recording
"""
import logging
import time
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models.models import (
    Automation, AutomationStep, AutomationLog,
    Message, Contact, MessageDirection, MessageStatus,
    LogStatus, StepType
)

logger = logging.getLogger(__name__)

_MAX_SEND_RETRIES = 3
_RETRY_DELAY_SECONDS = 3


class StepExecutionError(Exception):
    """Raised when a step execution fails."""
    pass


def _send_message_with_retry(db: Session, msg: Message, phone: str, body: str, contact: Optional[Contact], user_id: int) -> bool:
    """Send `msg`, retrying retryable failures (e.g. bridge unavailable) up to
    _MAX_SEND_RETRIES times with a short delay between attempts. Permanent
    failures (not connected, invalid number, blocked contact, bad message)
    are not retried. Mutates msg.status/error_message/retry_count/sent_at in
    place; never raises — check the return value / msg.status instead.
    """
    from services import whatsapp_service

    last_error = None
    for attempt in range(1, _MAX_SEND_RETRIES + 1):
        msg.status = MessageStatus.sending
        msg.retry_count = attempt - 1
        db.flush()
        try:
            whatsapp_service.send_whatsapp_message(db, phone, body, user_id, contact=contact)
            msg.status = MessageStatus.sent
            msg.sent_at = datetime.utcnow()
            msg.error_message = None
            db.flush()
            return True
        except Exception as send_err:
            last_error = send_err
            msg.retry_count = attempt
            retryable = getattr(send_err, "retryable", False)
            logger.warning(
                f"Send attempt {attempt}/{_MAX_SEND_RETRIES} to {phone} failed "
                f"(retryable={retryable}): {send_err}"
            )
            if not retryable or attempt == _MAX_SEND_RETRIES:
                break
            time.sleep(_RETRY_DELAY_SECONDS)

    msg.status = MessageStatus.failed
    msg.error_message = str(last_error)
    db.flush()
    logger.error(
        f"Message send FAILED — Recipient: {phone}  Retries: {msg.retry_count}  Reason: {last_error}"
    )
    return False


def _render_template(template_str: str, contact: Optional[Contact], context: Dict[str, Any]) -> str:
    if not template_str:
        return ""
    rendered = template_str
    if contact:
        rendered = rendered.replace("{{name}}", contact.name or "")
        rendered = rendered.replace("{{phone}}", contact.phone or "")
        rendered = rendered.replace("{{email}}", contact.email or "")
        rendered = rendered.replace("{{notes}}", contact.notes or "")
    
    # Incoming message details
    incoming_msg = context.get("content") or context.get("incoming_message") or ""
    rendered = rendered.replace("{{incoming_message}}", incoming_msg)
    rendered = rendered.replace("{{message}}", incoming_msg)
    
    # Support triggering variables dynamically
    for k, v in context.items():
        if isinstance(v, (str, int, float, bool)):
            rendered = rendered.replace(f"{{{{{k}}}}}", str(v))
            
    return rendered



def execute_step(db: Session, step: AutomationStep, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a single automation step based on step_type.
    Returns updated context dict.
    """
    logger.info(f"Executing step {step.step_order}: {step.step_type.value}")
    config = step.config or {}

    if step.step_type == StepType.send_message:
        message_template = config.get("message", "Hello!")
        target_type = config.get("target_type", "single")

        automation_owner_id = context.get("user_id")

        if target_type == "group":
            target_tag = config.get("target_tag", "")
            stagger_seconds = int(config.get("stagger_seconds", 5))

            # Query candidate contacts (scoped to this automation's owner)
            query = db.query(Contact).filter(Contact.user_id == automation_owner_id, Contact.is_active == True)
            if target_tag == "all":
                contacts_list = query.all()
            elif target_tag == "whatsapp_groups":
                contacts_list = query.filter(Contact.phone.like("%@g.us")).all()
            elif target_tag:
                # Filter in Python for database compatibility
                all_contacts = query.all()
                contacts_list = []
                for c in all_contacts:
                    c_tags = c.tags or []
                    if isinstance(c_tags, list) and target_tag in c_tags:
                        contacts_list.append(c)
                    elif isinstance(c_tags, str) and target_tag in c_tags:
                        contacts_list.append(c)
                    elif c.notes and target_tag.lower() in c.notes.lower():
                        contacts_list.append(c)
            else:
                contacts_list = query.all()

            logger.info(f"Targeting {len(contacts_list)} contacts matching tag/filter '{target_tag}' with delay {stagger_seconds}s")

            for idx, contact in enumerate(contacts_list):
                if idx > 0 and stagger_seconds > 0:
                    time.sleep(stagger_seconds)

                # Render template variables
                body = _render_template(message_template, contact, context)

                phone = contact.phone
                msg = Message(
                    user_id=automation_owner_id,
                    phone=phone,
                    contact_id=contact.id,
                    direction=MessageDirection.outbound,
                    content=body,
                    status=MessageStatus.pending,
                    automation_id=context.get("automation_id"),
                )
                db.add(msg)
                db.flush()

                _send_message_with_retry(db, msg, phone, body, contact, automation_owner_id)

            db.commit()
            return context
        else:
            phone = context.get("phone") or config.get("phone")
            
            # Resolve contact by ID or Phone number (scoped to this automation's owner)
            contact = context.get("contact")
            if not contact:
                contact_id_val = context.get("contact_id")
                if contact_id_val:
                    contact = db.query(Contact).filter(Contact.id == contact_id_val, Contact.user_id == automation_owner_id).first()
                elif phone:
                    clean_phone = "".join(filter(str.isdigit, phone))
                    if clean_phone:
                        contact = db.query(Contact).filter(
                            Contact.user_id == automation_owner_id,
                            (Contact.phone == phone) |
                            (Contact.phone.like(f"%{clean_phone}"))
                        ).first()
                
                if contact:
                    context["contact"] = contact
                    context["contact_id"] = contact.id

            message_template = _render_template(message_template, contact, context)

            if not phone:
                raise StepExecutionError(
                    "❌ No recipient — couldn't resolve a phone number or contact for this step."
                )

            # Save message record
            msg = Message(
                user_id=automation_owner_id,
                phone=phone,
                contact_id=context.get("contact_id"),
                direction=MessageDirection.outbound,
                content=message_template,
                status=MessageStatus.pending,
                automation_id=context.get("automation_id"),
            )
            db.add(msg)
            db.flush()

            success = _send_message_with_retry(db, msg, phone, message_template, contact, automation_owner_id)
            db.commit()
            if not success:
                raise StepExecutionError(
                    f"Automation: {context.get('automation_name', context.get('automation_id'))}\n"
                    f"Recipient: {phone}\n"
                    f"Status: FAILED\n"
                    f"Reason: {msg.error_message}\n"
                    f"Retries: {msg.retry_count}"
                )
            logger.info(f"Message successfully sent to {phone} via automation (retries: {msg.retry_count})")
            context["last_message_id"] = msg.id
            return context

    elif step.step_type == StepType.delay:
        seconds = int(config.get("seconds", 1))
        logger.info(f"Delay step: {seconds}s")
        time.sleep(min(seconds, 30))  # Cap at 30s in runner
        return context

    elif step.step_type == StepType.condition:
        field = config.get("field", "")
        operator = config.get("operator", "equals")
        value = config.get("value", "")
        context_value = str(context.get(field, ""))
        passed = {
            "equals": context_value == str(value),
            "not_equals": context_value != str(value),
            "contains": str(value) in context_value,
        }.get(operator, False)
        context["condition_passed"] = passed
        logger.info(f"Condition {field} {operator} {value}: {passed}")
        return context

    elif step.step_type == StepType.update_contact:
        contact_id = context.get("contact_id")
        if contact_id:
            contact = db.query(Contact).filter(Contact.id == contact_id).first()
            if contact:
                for field, val in config.items():
                    if hasattr(contact, field):
                        setattr(contact, field, val)
                db.flush()
        return context

    elif step.step_type == StepType.send_image:
        phone = context.get("phone") or config.get("phone")
        image_url = config.get("image_url", "")
        caption = config.get("caption", "")
        if phone and image_url:
            try:
                import httpx as _httpx
                from config.settings import settings as _s
                _httpx.post(
                    f"{_s.BRIDGE_URL}/send-media",
                    json={"phone": phone, "mediaUrl": image_url, "caption": caption},
                    timeout=15.0,
                )
                logger.info(f"Image sent to {phone}: {image_url}")
            except Exception as e:
                logger.error(f"Failed to send image to {phone}: {e}")
        return context

    elif step.step_type == StepType.add_tag:
        contact_id = context.get("contact_id")
        tag = config.get("tag", "").strip()
        if contact_id and tag:
            contact = db.query(Contact).filter(Contact.id == contact_id).first()
            if contact:
                tags = list(contact.tags or [])
                if tag not in tags:
                    tags.append(tag)
                    contact.tags = tags
                    db.flush()
                logger.info(f"Added tag '{tag}' to contact {contact_id}")
        return context

    elif step.step_type == StepType.remove_tag:
        contact_id = context.get("contact_id")
        tag = config.get("tag", "").strip()
        if contact_id and tag:
            contact = db.query(Contact).filter(Contact.id == contact_id).first()
            if contact:
                tags = list(contact.tags or [])
                if tag in tags:
                    tags.remove(tag)
                    contact.tags = tags
                    db.flush()
                logger.info(f"Removed tag '{tag}' from contact {contact_id}")
        return context

    elif step.step_type == StepType.react_message:
        message_id = context.get("whatsapp_message_id")
        emoji = config.get("emoji", "👍")
        if message_id:
            try:
                import httpx as _httpx
                from config.settings import settings as _s
                _httpx.post(
                    f"{_s.BRIDGE_URL}/react",
                    json={"messageId": message_id, "emoji": emoji},
                    timeout=5.0,
                )
                logger.info(f"Reacted to message {message_id} with {emoji}")
            except Exception as e:
                logger.warning(f"React failed: {e}")
        return context

    elif step.step_type == StepType.log:
        log_message = config.get("message", "Automation step executed")
        logger.info(f"[Automation Log] {log_message}")
        context.setdefault("log_messages", []).append(log_message)
        return context

    elif step.step_type == StepType.webhook:
        url = config.get("url", "")
        method = config.get("method", "POST").upper()
        headers = config.get("headers", {})
        body = config.get("body", {})
        if url:
            try:
                import httpx as _httpx
                _r = _httpx.request(method, url, json={**body, **context} if isinstance(body, dict) else body, headers=headers, timeout=10.0)
                logger.info(f"Webhook {method} {url} → {_r.status_code}")
                context["webhook_status"] = _r.status_code
            except Exception as e:
                logger.error(f"Webhook failed: {e}")
        return context

    else:
        logger.warning(f"Unknown step type: {step.step_type}")
        return context


def run_automation(db: Session, automation_id: int, trigger_data: Optional[Dict] = None, dry_run: bool = False) -> AutomationLog:
    """
    Execute an automation workflow.
    Loads steps in order, executes each, saves log, handles errors.
    """
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise ValueError(f"Automation {automation_id} not found")

    # Respect log control settings
    from services import logs_service as _ls
    _log_cfg = _ls.get_log_settings(db)
    _log_persisted = _log_cfg["logging_enabled"]

    logger.info(f"Starting automation {'[DRY RUN] ' if dry_run else ''}run: {automation.name} (ID: {automation_id})")
    start_time = time.time()

    log = AutomationLog(
        automation_id=automation_id,
        status=LogStatus.running,
        trigger_data=trigger_data or {},
        total_steps=len(automation.steps),
        started_at=datetime.utcnow(),
    )
    if _log_persisted:
        db.add(log)
        db.commit()
        db.refresh(log)
        _max = _log_cfg["max_log_entries"]
        if _max > 0:
            _ls.trim_to_limit(db, _max)

    # Build execution context
    context: Dict[str, Any] = {
        "automation_id": automation_id,
        "automation_name": automation.name,
        "user_id": automation.user_id,
        "log_id": log.id,
        "trigger_data": trigger_data or {},
    }

    if trigger_data:
        context.update(trigger_data)

    steps_executed = 0
    log_lines = []

    try:
        # Execute steps in order
        steps = sorted(automation.steps, key=lambda s: s.step_order)

        for step in steps:
            if not step.is_active:
                log_lines.append(f"[SKIP] Step {step.step_order}: {step.step_type.value} (inactive)")
                continue

            try:
                if dry_run:
                    # Simulate — describe what would happen without side-effects
                    cfg = step.config or {}
                    preview = ""
                    if step.step_type == StepType.send_message:
                        preview = f"would send: \"{str(cfg.get('message',''))[:60]}\""
                    elif step.step_type == StepType.send_image:
                        preview = f"would send image: {cfg.get('image_url','')}"
                    elif step.step_type == StepType.add_tag:
                        preview = f"would add tag: {cfg.get('tag','')}"
                    elif step.step_type == StepType.remove_tag:
                        preview = f"would remove tag: {cfg.get('tag','')}"
                    elif step.step_type == StepType.react_message:
                        preview = f"would react with: {cfg.get('emoji','👍')}"
                    elif step.step_type == StepType.delay:
                        preview = f"would wait {cfg.get('seconds',1)}s"
                    elif step.step_type == StepType.webhook:
                        preview = f"would POST to: {cfg.get('url','')}"
                    elif step.step_type == StepType.log:
                        preview = f"would log: \"{cfg.get('message','')}\""
                    else:
                        preview = "would execute"
                    log_lines.append(f"[DRY RUN] Step {step.step_order}: {step.step_type.value} — {preview}")
                else:
                    context = execute_step(db, step, context)
                steps_executed += 1
                log_lines.append(f"[OK] Step {step.step_order}: {step.step_type.value}")
            except StepExecutionError as se:
                log_lines.append(f"[FAIL] Step {step.step_order}: {se}")
                raise
            except Exception as e:
                log_lines.append(f"[ERROR] Step {step.step_order}: {e}")
                raise StepExecutionError(f"Step {step.step_order} failed: {e}")

        # Mark success
        elapsed_ms = (time.time() - start_time) * 1000
        log.status = LogStatus.success
        log.steps_executed = steps_executed
        log.execution_time = round(elapsed_ms, 2)
        log.log_output = "\n".join(log_lines)
        log.finished_at = datetime.utcnow()

        # Update automation stats
        automation.run_count = (automation.run_count or 0) + 1
        automation.last_run = datetime.utcnow()

        if _log_persisted:
            db.commit()
            db.refresh(log)
        else:
            db.commit()
        logger.info(f"Automation {automation_id} completed in {elapsed_ms:.0f}ms")
        return log

    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        log.status = LogStatus.failed
        log.steps_executed = steps_executed
        log.execution_time = round(elapsed_ms, 2)
        log.error_message = str(e)
        log.log_output = "\n".join(log_lines)
        log.finished_at = datetime.utcnow()

        automation.run_count = (automation.run_count or 0) + 1
        automation.last_run = datetime.utcnow()

        if _log_persisted:
            db.commit()
            db.refresh(log)
        else:
            db.commit()
        logger.error(f"Automation {automation_id} failed: {e}")
        return log
