import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("Restoring valid international contacts back to visible status in the database...")
    
    # Update is_valid=1 for any valid E.164 phone numbers that were falsely hidden (length <= 16 characters)
    query = text(
        "UPDATE contacts SET is_valid = 1 "
        "WHERE phone LIKE '+%' AND phone NOT LIKE '%@%' AND CHAR_LENGTH(phone) <= 16"
    )
    result = db.execute(query)
    db.commit()
    print(f"Successfully restored {result.rowcount} valid contacts!")
except Exception as e:
    db.rollback()
    print(f"Error restoring contacts: {e}")
finally:
    db.close()
