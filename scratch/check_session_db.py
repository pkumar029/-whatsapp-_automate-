import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = "C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend/database.db"

# Find database file
for root, dirs, files in os.walk("C:/Users/ELCOT/Desktop/project/whatsapp-automate/backend"):
    for file in files:
        if file.endswith('.db') or file.endswith('.sqlite'):
            db_path = os.path.join(root, file)
            print("Found DB:", db_path)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", tables)
    for table in tables:
        tname = table[0]
        if "session" in tname.lower():
            cursor.execute(f"SELECT * FROM {tname} ORDER BY id DESC LIMIT 5;")
            rows = cursor.fetchall()
            cursor.execute(f"PRAGMA table_info({tname});")
            cols = [col[1] for col in cursor.fetchall()]
            print(f"\nTable: {tname}")
            print("Columns:", cols)
            for row in rows:
                print(row)
except Exception as e:
    print(f"Error: {e}")
