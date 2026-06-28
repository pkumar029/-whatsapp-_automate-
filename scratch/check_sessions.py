import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import WhatsappSession

db = SessionLocal()
try:
    sessions = db.query(WhatsappSession).order_by(WhatsappSession.id.desc()).all()
    print(f"Total sessions: {len(sessions)}")
    for s in sessions:
        print(f"ID: {s.id} | Phone: {s.phone} | Status: {s.status} | ConnectionType: {s.session_data.get('connection_type') if s.session_data else 'None'} | Error: {s.error_message}")
finally:
    db.close()
