import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Contact

db = SessionLocal()
try:
    contacts = db.query(Contact).filter(Contact.wa_account == "917448582459").limit(10).all()
    print("Scanned contacts with wa_account = 917448582459:")
    for c in contacts:
        print(f"Name: {c.name} | Phone: {c.phone} | wa_account: {c.wa_account} | Tags: {c.tags}")
finally:
    db.close()
