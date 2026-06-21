"""
WhatsApp Service — Session management, QR login, message sending
Selected Package: pywa (Python WhatsApp library)
Docs: https://pywa.readthedocs.io
"""
import logging
import qrcode
import io
import base64
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models.models import WhatsappSession, SessionStatus
from config.settings import settings

logger = logging.getLogger(__name__)

# Global WhatsApp client instance
_wa_client = None
_session_id: Optional[int] = None


def _generate_qr_base64(data: str) -> str:
    """Generate a base64-encoded QR code image."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def get_or_create_session(db: Session) -> WhatsappSession:
    """Get the latest session or create a new one."""
    session = db.query(WhatsappSession).order_by(WhatsappSession.id.desc()).first()
    if not session:
        session = WhatsappSession(status=SessionStatus.disconnected)
        db.add(session)
        db.commit()
        db.refresh(session)
    return session


def get_session_status(db: Session) -> dict:
    """Get the current WhatsApp session status from database."""
    session = get_or_create_session(db)
    return {
        "status": session.status.value if session.status else "disconnected",
        "phone": session.phone,
        "connected_at": session.connected_at,
        "disconnected_at": session.disconnected_at,
        "error_message": session.error_message,
        "session_id": session.id,
    }


def connect_whatsapp(db: Session) -> dict:
    """
    Initiate WhatsApp connection.
    
    In a real deployment, this would:
    1. Initialize pywa client
    2. Generate QR code for scanning
    3. Wait for QR scan and session establishment
    4. Store session credentials
    
    For now, generates a demo QR code and updates session status to 'connecting'.
    """
    logger.info("Initiating WhatsApp connection...")
    
    session = get_or_create_session(db)
    
    try:
        # Update status to connecting
        session.status = SessionStatus.connecting
        session.error_message = None
        db.commit()

        # Generate demo QR code
        # In production: qr_data = wa_client.get_qr_code()
        qr_data = f"wa-connect:{datetime.utcnow().timestamp()}"
        qr_base64 = _generate_qr_base64(qr_data)

        # Store QR in session
        session.qr_code = qr_base64
        db.commit()
        db.refresh(session)

        logger.info(f"WhatsApp QR generated for session {session.id}")

        return {
            "status": "connecting",
            "message": "QR code generated. Scan with WhatsApp to connect.",
            "qr": qr_base64,
            "session_id": session.id,
        }

    except Exception as e:
        logger.error(f"WhatsApp connect error: {e}")
        session.status = SessionStatus.disconnected
        session.error_message = str(e)
        db.commit()
        raise


def disconnect_whatsapp(db: Session) -> dict:
    """Disconnect the WhatsApp session."""
    logger.info("Disconnecting WhatsApp session...")
    
    session = get_or_create_session(db)
    
    try:
        # In production: _wa_client.disconnect()
        session.status = SessionStatus.disconnected
        session.disconnected_at = datetime.utcnow()
        session.qr_code = None
        session.phone = None
        db.commit()
        
        logger.info(f"WhatsApp session {session.id} disconnected")
        
        return {
            "status": "disconnected",
            "message": "WhatsApp session disconnected successfully.",
        }
    except Exception as e:
        logger.error(f"WhatsApp disconnect error: {e}")
        raise


def send_whatsapp_message(db: Session, phone: str, message: str) -> dict:
    """
    Send a WhatsApp message.
    
    In production, uses pywa client:
        result = _wa_client.send_message(to=phone, text=message)
    """
    logger.info(f"Sending WhatsApp message to {phone}")
    
    # Check session status
    session = get_or_create_session(db)
    if session.status != SessionStatus.connected:
        raise ValueError("WhatsApp is not connected. Please connect first.")

    try:
        # In production: result = _wa_client.send_message(to=phone, text=message)
        # For now, simulate successful send
        message_id = f"wa_{datetime.utcnow().timestamp()}"
        
        logger.info(f"Message sent to {phone}: {message_id}")
        
        return {
            "success": True,
            "message_id": message_id,
            "phone": phone,
            "status": "sent",
        }
    except Exception as e:
        logger.error(f"Failed to send message to {phone}: {e}")
        raise


def simulate_connected(db: Session, phone: str = "+91 9876543210") -> dict:
    """
    Development helper: Mark session as connected (bypasses QR scan).
    Use this endpoint during development to test without real WhatsApp.
    """
    session = get_or_create_session(db)
    session.status = SessionStatus.connected
    session.phone = phone
    session.connected_at = datetime.utcnow()
    session.error_message = None
    db.commit()
    db.refresh(session)
    logger.info(f"Session {session.id} marked as connected (dev mode)")
    return {"status": "connected", "phone": phone, "session_id": session.id}


def refresh_session_if_needed(db: Session) -> bool:
    """Check if session needs refresh and attempt reconnection."""
    session = get_or_create_session(db)
    if session.status == SessionStatus.expired:
        logger.warning(f"Session {session.id} expired — attempting refresh")
        # In production: reconnect logic here
        return False
    return session.status == SessionStatus.connected
