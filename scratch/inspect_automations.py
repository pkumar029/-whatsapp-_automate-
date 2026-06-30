import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Automation, AutomationStep

db = SessionLocal()
try:
    automations = db.query(Automation).all()
    print(f"Total automations in DB: {len(automations)}")
    for a in automations:
        print(f"ID: {a.id} | Name: {a.name} | Active: {a.is_active} | Trigger: {a.trigger_type.value}")
        for s in sorted(a.steps, key=lambda x: x.step_order):
            print(f"  Step {s.step_order}: {s.step_type.value} | Config: {s.config}")
finally:
    db.close()
