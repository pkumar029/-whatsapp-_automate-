import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Message

db = SessionLocal()
try:
    msg = db.query(Message).filter(Message.error_message.like("%LID%")).order_by(Message.id.desc()).first()
    if msg:
        print(f"ID: {msg.id}")
        print(f"Phone/JID: {msg.phone}")
        print(f"Content: {msg.content}")
        print(f"Error Message: {msg.error_message}")
        print(f"Contact ID: {msg.contact_id}")
    else:
        print("No failed messages with LID error found in database.")
finally:
    db.close()
