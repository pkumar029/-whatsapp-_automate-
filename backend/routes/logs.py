"""
Logs Routes — List and manage execution logs
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import logs_service
from models.schemas import LogListResponse
from pydantic import BaseModel
from dependencies import current_user_id
import csv, io

router = APIRouter(prefix="/logs", tags=["Logs"])


class LogSettingsBody(BaseModel):
    logging_enabled: bool = True
    max_log_entries: int = 0


@router.get("", response_model=LogListResponse)
async def list_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    automation_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """List automation execution logs with filtering."""
    return logs_service.get_logs(db, user_id, page=page, limit=limit, search=search, status=status, automation_id=automation_id)


@router.get("/settings")
async def get_log_settings(db: Session = Depends(get_db)):
    """Get log control settings."""
    return logs_service.get_log_settings(db)


@router.put("/settings")
async def save_log_settings(body: LogSettingsBody, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Save log control settings and trim logs if max_log_entries is set."""
    return logs_service.save_log_settings(db, body.logging_enabled, body.max_log_entries, user_id)


@router.get("/export")
async def export_logs(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Export this user's logs as a CSV file."""
    rows = logs_service.export_logs_data(db, user_id)
    output = io.StringIO()
    fields = ["id", "automation_name", "status", "started_at", "finished_at",
              "execution_time_ms", "steps_executed", "total_steps", "error_message", "log_output"]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=automation_logs.csv"},
    )


@router.get("/automation/{automation_id}", response_model=LogListResponse)
async def logs_by_automation(
    automation_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: int = Depends(current_user_id),
):
    """Get logs for a specific automation."""
    return logs_service.get_logs(db, user_id, page=page, limit=limit, automation_id=automation_id)


@router.delete("")
async def clear_logs(db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Clear this user's execution logs."""
    count = logs_service.clear_logs(db, user_id)
    return {"success": True, "deleted": count}


@router.get("/{log_id}")
async def get_log(log_id: int, db: Session = Depends(get_db), user_id: int = Depends(current_user_id)):
    """Get a single log entry."""
    log = logs_service.get_log_by_id(db, log_id, user_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log
