import sys
import os
import httpx

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("Wiping transactional database records (contacts, message logs, sessions)...")
    
    # 1. Disable foreign key checks temporarily to safely wipe tables
    db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    
    # 2. Truncate/delete transactional tables
    print("Clearing message_jobs...")
    db.execute(text("TRUNCATE TABLE message_jobs"))
    
    print("Clearing messages...")
    db.execute(text("TRUNCATE TABLE messages"))
    
    print("Clearing automation_logs...")
    db.execute(text("TRUNCATE TABLE automation_logs"))
    
    print("Clearing contacts...")
    db.execute(text("TRUNCATE TABLE contacts"))
    
    print("Clearing whatsapp_sessions...")
    db.execute(text("TRUNCATE TABLE whatsapp_sessions"))
    
    print("Clearing whatsapp_profiles...")
    db.execute(text("TRUNCATE TABLE whatsapp_profiles"))
    
    # 3. Enable foreign key checks back
    db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    db.commit()
    print("Database transaction data wiped successfully!")
    
except Exception as e:
    db.rollback()
    print(f"Database wipe failed: {e}")
finally:
    db.close()

# 4. Clear bridge session files to require a new QR scan
try:
    print("Requesting WhatsApp bridge to clear saved authentication sessions...")
    r = httpx.post("http://localhost:7002/clear-session", timeout=10.0)
    print(f"Bridge response: {r.json()}")
except Exception as e:
    print(f"Failed to clear bridge session files: {e}")
