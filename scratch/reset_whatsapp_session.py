import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import WhatsappSession

def reset():
    db = SessionLocal()
    try:
        deleted = db.query(WhatsappSession).delete()
        db.commit()
        print(f"[Success] Deleted {deleted} stale session rows from database.")
    except Exception as e:
        db.rollback()
        print(f"[Error] Reset failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset()
