import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from routes.contacts import get_whatsapp_chats
from database.connection import SessionLocal

db = SessionLocal()
try:
    print("Calling get_whatsapp_chats(db) directly in python...")
    res = get_whatsapp_chats(db)
    print(f"Result: {res}")
except Exception as e:
    print(f"Execution failed: {e}")
finally:
    db.close()
