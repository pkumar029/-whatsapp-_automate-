import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import WhatsappSession, SessionStatus

db = SessionLocal()
try:
    session = db.query(WhatsappSession).order_by(WhatsappSession.id.desc()).first()
    if session:
        session.status = SessionStatus.disconnected
        session.error_message = None
        session.qr_code = None
        session.session_data = {}
        db.commit()
        print("Latest session cleared successfully.")
    else:
        print("No session to clear.")
finally:
    db.close()
