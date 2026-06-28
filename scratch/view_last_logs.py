import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import AutomationLog

def view_logs():
    db = SessionLocal()
    try:
        logs = db.query(AutomationLog).order_by(AutomationLog.created_at.desc()).limit(5).all()
        print(f"Last {len(logs)} execution logs:")
        for log in logs:
            print(f"ID: {log.id} | Auto ID: {log.automation_id} | Status: {log.status} | Err: {log.error_message} | Created: {log.created_at}")
    finally:
        db.close()

if __name__ == "__main__":
    view_logs()
