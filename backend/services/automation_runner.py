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


class StepExecutionError(Exception):
    """Raised when a step execution fails."""
    pass


def execute_step(db: Session, step: AutomationStep, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a single automation step based on step_type.
    Returns updated context dict.
    """
    logger.info(f"Executing step {step.step_order}: {step.step_type.value}")
    config = step.config or {}

    if step.step_type == StepType.send_message:
        phone = context.get("phone") or config.get("phone")
        message_template = config.get("message", "Hello!")

        # Simple template variable substitution
        contact = context.get("contact")
        if not contact and context.get("contact_id"):
            contact = db.query(Contact).filter(Contact.id == context.get("contact_id")).first()
            if contact:
                context["contact"] = contact

        if contact:
            message_template = message_template.replace("{{name}}", contact.name or "")
            message_template = message_template.replace("{{phone}}", contact.phone or "")

        if phone:
            # Save message record
            msg = Message(
                phone=phone,
                contact_id=context.get("contact_id"),
                direction=MessageDirection.outbound,
                content=message_template,
                status=MessageStatus.pending,
                automation_id=context.get("automation_id"),
            )
            db.add(msg)
            db.flush()
            
            try:
                from services import whatsapp_service
                whatsapp_service.send_whatsapp_message(db, phone, message_template)
                msg.status = MessageStatus.sent
                msg.sent_at = datetime.utcnow()
                db.flush()
                logger.info(f"Message successfully sent to {phone} via automation")
            except Exception as send_err:
                msg.status = MessageStatus.failed
                msg.error_message = str(send_err)
                db.flush()
                logger.error(f"Failed to send automation message: {send_err}")
                raise StepExecutionError(f"Failed to send WhatsApp message: {send_err}")
                
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

    elif step.step_type == StepType.log:
        log_message = config.get("message", "Automation step executed")
        logger.info(f"[Automation Log] {log_message}")
        context.setdefault("log_messages", []).append(log_message)
        return context

    elif step.step_type == StepType.webhook:
        # Placeholder: in production, make HTTP request
        url = config.get("url", "")
        logger.info(f"Webhook step: {url} (skipped in dev)")
        return context

    else:
        logger.warning(f"Unknown step type: {step.step_type}")
        return context


def run_automation(db: Session, automation_id: int, trigger_data: Optional[Dict] = None) -> AutomationLog:
    """
    Execute an automation workflow.
    Loads steps in order, executes each, saves log, handles errors.
    """
    automation = db.query(Automation).filter(Automation.id == automation_id).first()
    if not automation:
        raise ValueError(f"Automation {automation_id} not found")

    logger.info(f"Starting automation run: {automation.name} (ID: {automation_id})")
    start_time = time.time()

    # Create log entry
    log = AutomationLog(
        automation_id=automation_id,
        status=LogStatus.running,
        trigger_data=trigger_data or {},
        total_steps=len(automation.steps),
        started_at=datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # Build execution context
    context: Dict[str, Any] = {
        "automation_id": automation_id,
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

        db.commit()
        db.refresh(log)
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

        db.commit()
        db.refresh(log)
        logger.error(f"Automation {automation_id} failed: {e}")
        return log
