import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("Checking if 'wa_account' column exists in 'messages' table...")
    # Get columns of messages table
    result = db.execute(text("SHOW COLUMNS FROM messages"))
    columns = [row[0] for row in result.fetchall()]
    print(f"Columns: {columns}")
    if "wa_account" not in columns:
        print("Column 'wa_account' not found. Adding it to 'messages' table...")
        db.execute(text("ALTER TABLE messages ADD COLUMN wa_account VARCHAR(100) NULL"))
        print("Adding index 'idx_message_wa_account'...")
        db.execute(text("CREATE INDEX idx_message_wa_account ON messages (wa_account)"))
        db.commit()
        print("Successfully updated database schema!")
    else:
        print("Column 'wa_account' already exists in 'messages' table.")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
