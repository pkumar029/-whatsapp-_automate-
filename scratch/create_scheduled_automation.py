import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Automation, AutomationStep, TriggerType, StepType

def create_scheduled():
    db = SessionLocal()
    try:
        # Check if exists
        existing = db.query(Automation).filter(Automation.name == "Scheduled Check-in Alert").first()
        if existing:
            db.delete(existing)
            db.commit()

        # Create scheduled automation
        automation = Automation(
            name="Scheduled Check-in Alert",
            description="Sends a scheduled check-in message to +91 95852 75395 every 5 minutes.",
            trigger_type=TriggerType.schedule,
            trigger_config={"cron": "*/5 * * * *"},
            is_active=True
        )
        db.add(automation)
        db.flush()

        # Step 1: Send Message to static phone number
        step_1 = AutomationStep(
            automation_id=automation.id,
            step_type=StepType.send_message,
            step_order=1,
            name="Send Alert to Admin",
            config={
                "message": "System status update: All services are running optimally. Have a great day!",
                "target_type": "single",
                "phone": "9585275395"
            }
        )
        db.add(step_1)
        
        db.commit()
        print(f"[Success] Scheduled Automation created successfully.")
        print(f"   Name: {automation.name}")
        print(f"   ID: {automation.id}")
        print(f"   Recipient Phone: 9585275395")
        print(f"   Schedule Cron: */5 * * * *")
        
    except Exception as e:
        db.rollback()
        print(f"[Error] Failed to create scheduled automation: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_scheduled()
