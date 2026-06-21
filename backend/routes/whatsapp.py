"""
WhatsApp Routes — Connect, disconnect, status, send message
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from services import whatsapp_service
from models.schemas import WhatsAppSendRequest, WhatsAppStatusResponse, WhatsAppConnectResponse

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


@router.get("/status", response_model=WhatsAppStatusResponse)
async def get_status(db: Session = Depends(get_db)):
    """Get current WhatsApp session status."""
    return whatsapp_service.get_session_status(db)


@router.post("/connect", response_model=WhatsAppConnectResponse)
async def connect(db: Session = Depends(get_db)):
    """Initiate WhatsApp connection and get QR code."""
    try:
        return whatsapp_service.connect_whatsapp(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect")
async def disconnect(db: Session = Depends(get_db)):
    """Disconnect WhatsApp session."""
    try:
        return whatsapp_service.disconnect_whatsapp(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send")
async def send_message(data: WhatsAppSendRequest, db: Session = Depends(get_db)):
    """Send a WhatsApp message directly."""
    try:
        return whatsapp_service.send_whatsapp_message(db, data.phone, data.message)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/qr")
async def get_qr(db: Session = Depends(get_db)):
    """Get current QR code if available."""
    from models.models import WhatsappSession
    session = db.query(WhatsappSession).order_by(WhatsappSession.id.desc()).first()
    if not session or not session.qr_code:
        raise HTTPException(status_code=404, detail="No QR code available")
    return {"qr": session.qr_code}


@router.post("/dev/connect")
async def dev_connect(phone: str = "+91 9876543210", db: Session = Depends(get_db)):
    """DEV ONLY: Mark session as connected without QR scan."""
    return whatsapp_service.simulate_connected(db, phone)
