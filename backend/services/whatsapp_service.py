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
    connection_type = session.session_data.get("connection_type") if session.session_data else None
    pairing_code = None
    
    # If connection type is bridge and status is connecting or connected, check bridge status
    if connection_type == "bridge" and session.status in (SessionStatus.connecting, SessionStatus.connected):
        try:
            import httpx
            r = httpx.get("http://localhost:7002/status", timeout=5.0)
            if r.status_code == 200:
                bridge_data = r.json()
                bridge_status = bridge_data.get("status")
                pairing_code = bridge_data.get("pairing_code")
                bridge_error = bridge_data.get("error")
                
                # Update DB state based on bridge state
                if bridge_status == "connected":
                    session.status = SessionStatus.connected
                    session.phone = bridge_data.get("phone")
                    session.connected_at = datetime.utcnow()
                    session.qr_code = None
                    session.error_message = None
                    db.commit()
                    # Adopt any ownerless contacts into this account (one-time migration)
                    if session.phone:
                        from services.contacts_service import claim_orphan_contacts
                        claim_orphan_contacts(db, session.phone)
                elif bridge_status == "connecting":
                    session.qr_code = bridge_data.get("qr")
                    if bridge_error:
                        session.error_message = bridge_error
                    db.commit()
                elif bridge_status == "disconnected" or bridge_status == "error":
                    session.status = SessionStatus.disconnected
                    session.qr_code = None
                    session.error_message = bridge_error
                    db.commit()
        except Exception as e:
            logger.warning(f"Failed to check bridge status: {e}")

    return {
        "status": session.status.value if session.status else "disconnected",
        "phone": session.phone,
        "connected_at": session.connected_at,
        "disconnected_at": session.disconnected_at,
        "error_message": session.error_message,
        "session_id": session.id,
        "connection_type": connection_type,
        "pairing_code": pairing_code,
        "qr": session.qr_code,
    }


def connect_whatsapp(db: Session) -> dict:
    """Fallback legacy connection call."""
    logger.info("Initiating legacy WhatsApp connection...")
    session = get_or_create_session(db)
    session.status = SessionStatus.connecting
    db.commit()
    qr_data = f"wa-connect:{datetime.utcnow().timestamp()}"
    qr_base64 = _generate_qr_base64(qr_data)
    session.qr_code = qr_base64
    db.commit()
    return {
        "status": "connecting",
        "message": "QR code generated. Scan with WhatsApp to connect.",
        "qr": qr_base64,
        "session_id": session.id,
    }


def connect_whatsapp_with_config(db: Session, config: "WhatsAppConnectRequest") -> dict:
    """Initiate connection depending on connection type."""
    logger.info(f"Connecting WhatsApp with type: {config.connection_type}")
    session = get_or_create_session(db)
    
    session.error_message = None
    session.qr_code = None
    
    session_data = {
        "connection_type": config.connection_type,
    }
    
    if config.connection_type == "dev":
        phone = config.phone or "+91 9876543210"
        session.status = SessionStatus.connected
        session.phone = phone
        session.connected_at = datetime.utcnow()
        session_data["phone"] = phone
        session.session_data = session_data
        db.commit()
        db.refresh(session)
        return {
            "status": "connected",
            "message": "Dev connection simulated successfully.",
            "session_id": session.id
        }
        
    elif config.connection_type == "meta":
        if not config.meta_token or not config.meta_phone_number_id or not config.meta_business_account_id:
            raise ValueError("Token, Phone Number ID and Business Account ID are required for Meta API.")
        
        phone = config.phone or "Official Business Account"
        session_data.update({
            "phone": phone,
            "meta_token": config.meta_token,
            "meta_phone_number_id": config.meta_phone_number_id,
            "meta_business_account_id": config.meta_business_account_id
        })
        session.status = SessionStatus.connected
        session.phone = phone
        session.connected_at = datetime.utcnow()
        session.session_data = session_data
        db.commit()
        db.refresh(session)
        return {
            "status": "connected",
            "message": "Meta API connection saved successfully.",
            "session_id": session.id
        }
        
    elif config.connection_type == "bridge":
        import httpx
        try:
            session_data["phone"] = config.phone
            session.session_data = session_data
            session.status = SessionStatus.connecting
            db.commit()
            
            # Request connection from bridge
            payload = {}
            if config.phone:
                payload["phone"] = config.phone
            if config.link_method:
                payload["linkMethod"] = config.link_method
            r = httpx.post("http://localhost:7002/connect", json=payload, timeout=5.0)
            if r.status_code != 200:
                raise Exception(f"Bridge server returned status code {r.status_code}")
                
            # Immediately get bridge status — may already be connected (saved session)
            r_status = httpx.get("http://localhost:7002/status", timeout=5.0)
            qr_base64 = None
            pairing_code = None
            if r_status.status_code == 200:
                bridge_data = r_status.json()
                bridge_status = bridge_data.get("status")

                if bridge_status == "connected":
                    session.status = SessionStatus.connected
                    session.phone = bridge_data.get("phone")
                    session.connected_at = datetime.utcnow()
                    session.qr_code = None
                    db.commit()
                    if session.phone:
                        from services.contacts_service import claim_orphan_contacts
                        claim_orphan_contacts(db, session.phone)
                    return {
                        "status": "connected",
                        "message": "WhatsApp connected successfully.",
                        "phone": session.phone,
                        "session_id": session.id,
                    }

                qr_base64 = bridge_data.get("qr")
                pairing_code = bridge_data.get("pairing_code")

            session.qr_code = qr_base64
            db.commit()
            db.refresh(session)

            msg = "Connecting to whatsapp-web.js bridge. "
            if pairing_code:
                msg += f"Pairing code generated: {pairing_code}"
            else:
                msg += "Waiting for QR code..."

            return {
                "status": "connecting",
                "message": msg,
                "qr": qr_base64,
                "pairing_code": pairing_code,
                "session_id": session.id
            }
        except Exception as e:
            logger.error(f"Failed to connect to bridge: {e}")
            session.status = SessionStatus.disconnected
            session.error_message = f"Failed to connect to whatsapp-web.js bridge: ensure node server is running on port 7002. ({str(e)})"
            db.commit()
            raise Exception(session.error_message)
    else:
        raise ValueError(f"Unknown connection type: {config.connection_type}")


def disconnect_whatsapp(db: Session) -> dict:
    """Disconnect the WhatsApp session."""
    logger.info("Disconnecting WhatsApp session...")
    session = get_or_create_session(db)
    connection_type = session.session_data.get("connection_type") if session.session_data else None
    
    try:
        if connection_type == "bridge":
            import httpx
            try:
                httpx.post("http://localhost:7002/disconnect", timeout=5.0)
            except Exception as e:
                logger.warning(f"Failed to notify bridge of disconnect: {e}")
                
        session.status = SessionStatus.disconnected
        session.disconnected_at = datetime.utcnow()
        session.qr_code = None
        session.phone = None
        session.session_data = None
        db.commit()
        
        logger.info(f"WhatsApp session {session.id} disconnected")
        
        return {
            "status": "disconnected",
            "message": "WhatsApp session disconnected successfully.",
        }
    except Exception as e:
        logger.error(f"WhatsApp disconnect error: {e}")
        raise


def clear_bridge_session() -> dict:
    """Tell the bridge to wipe its saved LocalAuth session.

    Should be called when the user explicitly wants to switch to a different
    WhatsApp account.  Normal disconnect/reconnect does NOT call this so that
    the same number can reconnect without scanning a new QR code.
    """
    try:
        import httpx
        r = httpx.post("http://localhost:7002/clear-session", timeout=5.0)
        r.raise_for_status()
        return {"success": True, "message": "Bridge session cleared"}
    except Exception as e:
        logger.warning(f"Failed to clear bridge session: {e}")
        return {"success": False, "message": str(e)}


def send_whatsapp_message(db: Session, phone: str, message: str) -> dict:
    """Send a WhatsApp message based on connection type."""
    logger.info(f"Sending WhatsApp message to {phone}")
    session = get_or_create_session(db)
    if session.status != SessionStatus.connected:
        raise ValueError("WhatsApp is not connected. Please connect first.")
        
    connection_type = session.session_data.get("connection_type") if session.session_data else "dev"
    
    try:
        if connection_type == "dev":
            message_id = f"dev_{datetime.utcnow().timestamp()}"
            logger.info(f"[DEV BYPASS] Message sent to {phone}: {message}")
            return {
                "success": True,
                "message_id": message_id,
                "phone": phone,
                "status": "sent",
            }
            
        elif connection_type == "meta":
            meta_token = session.session_data.get("meta_token")
            phone_number_id = session.session_data.get("meta_phone_number_id")
            
            if not meta_token or not phone_number_id:
                raise ValueError("Meta API credentials missing from session.")
                
            clean_phone = "".join(filter(str.isdigit, phone))
            
            # Support dummy/testing values to simulate Meta API
            if meta_token.startswith("dummy") or meta_token.startswith("test"):
                message_id = f"meta_sim_{datetime.utcnow().timestamp()}"
                logger.info(f"[META API SIMULATED] Message sent to {phone}: {message}")
                return {
                    "success": True,
                    "message_id": message_id,
                    "phone": phone,
                    "status": "sent",
                }
            
            import httpx
            url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {meta_token}",
                "Content-Type": "application/json"
            }
            payload = {
                "messaging_product": "whatsapp",
                "to": clean_phone,
                "type": "text",
                "text": {
                    "body": message
                }
            }
            r = httpx.post(url, headers=headers, json=payload, timeout=10.0)
            if r.status_code != 200:
                res_data = r.json()
                error_msg = res_data.get("error", {}).get("message", "Unknown Meta API error")
                raise Exception(f"Meta API error: {error_msg}")
                
            res_data = r.json()
            message_id = res_data.get("messages", [{}])[0].get("id", f"meta_{datetime.utcnow().timestamp()}")
            return {
                "success": True,
                "message_id": message_id,
                "phone": phone,
                "status": "sent",
            }
            
        elif connection_type == "bridge":
            import httpx
            payload = {
                "phone": phone,
                "message": message
            }
            r = httpx.post("http://localhost:7002/send", json=payload, timeout=15.0)
            if r.status_code != 200:
                res_data = r.json()
                error_msg = res_data.get("error", "Unknown bridge error")
                raise Exception(f"Bridge error: {error_msg}")
                
            res_data = r.json()
            return {
                "success": True,
                "message_id": res_data.get("message_id"),
                "phone": phone,
                "status": "sent",
            }
        else:
            raise ValueError(f"Unknown connection type: {connection_type}")
    except Exception as e:
        logger.error(f"Failed to send message to {phone}: {e}")
        raise


def simulate_connected(db: Session, phone: str = "+91 9876543210") -> dict:
    """Development helper: Mark session as connected."""
    session = get_or_create_session(db)
    session.status = SessionStatus.connected
    session.phone = phone
    session.connected_at = datetime.utcnow()
    session.error_message = None
    session.session_data = {"connection_type": "dev", "phone": phone}
    db.commit()
    db.refresh(session)
    logger.info(f"Session {session.id} marked as connected (dev mode)")
    return {"status": "connected", "phone": phone, "session_id": session.id}


def refresh_session_if_needed(db: Session) -> bool:
    """Check if session needs refresh."""
    session = get_or_create_session(db)
    if session.status == SessionStatus.expired:
        logger.warning(f"Session {session.id} expired — attempting refresh")
        return False
    return session.status == SessionStatus.connected
