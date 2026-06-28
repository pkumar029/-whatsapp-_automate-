import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Contact

def check():
    db = SessionLocal()
    try:
        contacts = db.query(Contact).all()
        print(f"Total contacts: {len(contacts)}")
        for c in contacts:
            print(f"ID: {c.id} | Name: {c.name} | Phone: {c.phone} | Notes: {c.notes}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
