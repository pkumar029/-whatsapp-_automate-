import sys
import os

# Add backend directory to sys.path so we can import modules
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

# Change working directory to backend so config can locate the .env file
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Automation, AutomationStep, TriggerType, StepType

def create_example():
    db = SessionLocal()
    try:
        # Check if the example already exists
        existing = db.query(Automation).filter(Automation.name == "Welcome & Onboarding Funnel").first()
        if existing:
            print(f"Example automation already exists with ID: {existing.id}. Deleting and recreating...")
            db.delete(existing)
            db.commit()

        # Create Automation
        automation = Automation(
            name="Welcome & Onboarding Funnel",
            description="Auto-responds to 'hello' keyword, waits, sends a templated welcome message, and tags the contact.",
            trigger_type=TriggerType.keyword,
            trigger_config={"keyword": "hello"},
            is_active=True
        )
        db.add(automation)
        db.flush() # Get automation.id

        # Step 1: Delay Action
        step_1 = AutomationStep(
            automation_id=automation.id,
            step_type=StepType.delay,
            step_order=1,
            name="Simulate Human Pause",
            config={"seconds": 2}
        )
        db.add(step_1)

        # Step 2: Send WhatsApp Message
        step_2 = AutomationStep(
            automation_id=automation.id,
            step_type=StepType.send_message,
            step_order=2,
            name="Send Welcome Greeting",
            config={
                "message": "Hello {{name}}! Welcome to our automated services. We are thrilled to connect with you.\n\nReply with 'pricing' to view our plans, or 'help' to connect with support."
            }
        )
        db.add(step_2)

        # Step 3: Update Contact
        step_3 = AutomationStep(
            automation_id=automation.id,
            step_type=StepType.update_contact,
            step_order=3,
            name="Update Onboarding Tag",
            config={
                "notes": "Completed hello onboarding funnel."
            }
        )
        db.add(step_3)

        db.commit()
        print(f"[Success] Example Automation created successfully.")
        print(f"   Name: {automation.name}")
        print(f"   ID: {automation.id}")
        print(f"   Trigger Keyword: hello")
        print(f"   Steps Count: 3")
        
    except Exception as e:
        db.rollback()
        print(f"[Error] Failed to create example automation: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_example()
