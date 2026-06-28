import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Contact
from sqlalchemy import func

db = SessionLocal()
try:
    total = db.query(Contact).count()
    null_wa = db.query(Contact).filter(Contact.wa_account == None).count()
    by_wa = db.query(Contact.wa_account, func.count(Contact.id)).group_by(Contact.wa_account).all()
    print(f"Total contacts in DB: {total}")
    print(f"Contacts with wa_account = NULL: {null_wa}")
    print("Contacts grouped by wa_account:")
    for wa, count in by_wa:
        print(f"  wa_account: {wa} | count: {count}")
finally:
    db.close()
