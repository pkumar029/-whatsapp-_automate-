import sys
import os
from sqlalchemy import text

# Add backend directory to sys.path so we can import connection
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import engine

def migrate():
    print("Running database migration to expand phone column sizes to VARCHAR(100)...")
    
    statements = [
        "ALTER TABLE contacts MODIFY COLUMN phone VARCHAR(100) NOT NULL;",
        "ALTER TABLE messages MODIFY COLUMN phone VARCHAR(100) NOT NULL;",
        "ALTER TABLE message_jobs MODIFY COLUMN phone VARCHAR(100) NOT NULL;",
        "ALTER TABLE whatsapp_sessions MODIFY COLUMN phone VARCHAR(100) NULL;"
    ]

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            for stmt in statements:
                print(f"Executing: {stmt}")
                conn.execute(text(stmt))
            trans.commit()
            print("Database column alteration completed successfully!")
        except Exception as e:
            trans.rollback()
            print(f"Migration failed: {e}")
            sys.exit(1)

if __name__ == "__main__":
    migrate()
