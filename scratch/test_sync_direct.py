import sys
import os
import traceback

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from services.contacts_service import sync_whatsapp_contacts

db = SessionLocal()
try:
    print("Testing sync_whatsapp_contacts(db) directly to capture traceback...")
    res = sync_whatsapp_contacts(db)
    print(f"Success! Result: {res}")
except Exception as e:
    print("Error caught during sync:")
    print("-" * 60)
    traceback.print_exc()
    print("-" * 60)
finally:
    db.close()
