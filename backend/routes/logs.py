"""
Logs Routes — List and manage execution logs
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session
from database.connection import get_db
from services import logs_service
from models.schemas import LogListResponse

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.get("", response_model=LogListResponse)
async def list_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    automation_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """List automation execution logs with filtering."""
    return logs_service.get_logs(db, page=page, limit=limit, search=search, status=status, automation_id=automation_id)


@router.get("/automation/{automation_id}", response_model=LogListResponse)
async def logs_by_automation(
    automation_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get logs for a specific automation."""
    return logs_service.get_logs(db, page=page, limit=limit, automation_id=automation_id)


@router.get("/{log_id}")
async def get_log(log_id: int, db: Session = Depends(get_db)):
    """Get a single log entry."""
    log = logs_service.get_log_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@router.delete("")
async def clear_logs(db: Session = Depends(get_db)):
    """Clear all execution logs."""
    count = logs_service.clear_logs(db)
    return {"success": True, "deleted": count}
