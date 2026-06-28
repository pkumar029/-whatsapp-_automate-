import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import WhatsappSession

def check():
    db = SessionLocal()
    try:
        session = db.query(WhatsappSession).order_by(WhatsappSession.id.desc()).first()
        if session:
            print(f"Session ID: {session.id}")
            print(f"Status: {session.status}")
            print(f"Phone: {session.phone}")
            print(f"Session Data: {session.session_data}")
        else:
            print("No WhatsApp session found.")
    finally:
        db.close()

if __name__ == "__main__":
    check()
