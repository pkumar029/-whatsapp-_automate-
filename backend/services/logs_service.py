"""
Logs Service — Retrieve and manage automation execution logs
"""
import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.models import AutomationLog, Automation, LogStatus, SystemSettings

logger = logging.getLogger(__name__)

_LOG_ENABLED_KEY = "log_enabled"
_LOG_MAX_ENTRIES_KEY = "log_max_entries"


def get_log_settings(db: Session) -> dict:
    rows = db.query(SystemSettings).filter(
        SystemSettings.key.in_([_LOG_ENABLED_KEY, _LOG_MAX_ENTRIES_KEY])
    ).all()
    data = {r.key: r.value for r in rows}
    return {
        "logging_enabled": data.get(_LOG_ENABLED_KEY, "true") != "false",
        "max_log_entries": int(data.get(_LOG_MAX_ENTRIES_KEY, "100") or "100"),
    }


def save_log_settings(db: Session, logging_enabled: bool, max_log_entries: int, user_id: int) -> dict:
    for key, val in [
        (_LOG_ENABLED_KEY, "true" if logging_enabled else "false"),
        (_LOG_MAX_ENTRIES_KEY, str(max(0, max_log_entries))),
    ]:
        row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if row:
            row.value = val
        else:
            db.add(SystemSettings(key=key, value=val))
    db.commit()
    if max_log_entries > 0:
        trim_to_limit(db, max_log_entries, user_id)
    return get_log_settings(db)


def _user_log_ids_query(db: Session, user_id: int, wa_account: Optional[str] = None):
    """AutomationLog has no user_id of its own — ownership flows through
    automation_id — so every log query joins through Automation. Always
    filtered by the authenticated user_id (never a client-supplied value);
    optionally further scoped to the active WhatsApp account, same as the
    automations/campaigns lists."""
    query = db.query(AutomationLog).join(Automation, AutomationLog.automation_id == Automation.id).filter(Automation.user_id == user_id)
    if wa_account:
        query = query.filter((Automation.wa_account == wa_account) | Automation.wa_account.is_(None))
    return query


def trim_to_limit(db: Session, max_entries: int, user_id: int) -> int:
    """Trim this user's oldest logs only — a global trim would let one
    user's heavy automation usage evict another user's log history."""
    if max_entries <= 0:
        return 0
    total = _user_log_ids_query(db, user_id).count()
    if total <= max_entries:
        return 0
    excess = total - max_entries
    oldest_ids = [
        row.id for row in
        _user_log_ids_query(db, user_id)
          .order_by(AutomationLog.started_at.asc())
          .limit(excess)
          .all()
    ]
    if oldest_ids:
        db.query(AutomationLog).filter(AutomationLog.id.in_(oldest_ids)).delete(synchronize_session=False)
        db.commit()
    return len(oldest_ids)


def export_logs_data(db: Session, user_id: int, wa_account: Optional[str] = None) -> list:
    logs = _user_log_ids_query(db, user_id, wa_account).order_by(AutomationLog.started_at.desc()).all()
    result = []
    for log in logs:
        automation = db.query(Automation).filter(Automation.id == log.automation_id).first()
        result.append({
            "id": log.id,
            "automation_name": automation.name if automation else f"Automation #{log.automation_id}",
            "status": log.status.value if log.status else "unknown",
            "started_at": log.started_at.isoformat() if log.started_at else "",
            "finished_at": log.finished_at.isoformat() if log.finished_at else "",
            "execution_time_ms": log.execution_time,
            "steps_executed": log.steps_executed,
            "total_steps": log.total_steps,
            "error_message": log.error_message or "",
            "log_output": log.log_output or "",
        })
    return result


def get_logs(
    db: Session,
    user_id: int,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    automation_id: Optional[int] = None,
    wa_account: Optional[str] = None,
) -> dict:
    # Auto-maintenance: trim to configured max on every fetch (cheap no-op when under limit)
    cfg = get_log_settings(db)
    max_entries = cfg["max_log_entries"]
    if max_entries > 0:
        trim_to_limit(db, max_entries, user_id)

    query = _user_log_ids_query(db, user_id, wa_account)

    if status:
        query = query.filter(AutomationLog.status == status)
    if automation_id:
        query = query.filter(AutomationLog.automation_id == automation_id)
    if search:
        # Filter by automation name via subquery
        matching_ids = [
            a.id for a in db.query(Automation).filter(Automation.name.ilike(f"%{search}%"), Automation.user_id == user_id).all()
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


def get_log_by_id(db: Session, log_id: int, user_id: int) -> Optional[AutomationLog]:
    return _user_log_ids_query(db, user_id).filter(AutomationLog.id == log_id).first()


def clear_logs(db: Session, user_id: int, wa_account: Optional[str] = None) -> int:
    ids = [row.id for row in _user_log_ids_query(db, user_id, wa_account).with_entities(AutomationLog.id).all()]
    if ids:
        db.query(AutomationLog).filter(AutomationLog.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
    logger.info(f"Cleared {len(ids)} log entries for user {user_id}")
    return len(ids)
