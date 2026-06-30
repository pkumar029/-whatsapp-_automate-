import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Automation, AutomationStep, TriggerType, StepType

db = SessionLocal()
try:
    print("Creating example automation 'Lead Capture & Auto-Response'...")
    
    # 1. Create Automation
    auto = Automation(
        name="Lead Capture & Auto-Response",
        description="Triggered when someone messages 'Interested'. Adds the 'Warm Lead' tag, waits 2 seconds, and replies with a welcome message.",
        trigger_type=TriggerType.keyword_pattern,
        trigger_config={"pattern": "interested", "match_mode": "contains"},
        is_active=True,
        cooldown_minutes=1
    )
    db.add(auto)
    db.flush() # Get auto.id
    
    # 2. Step 1: Add Tag
    step1 = AutomationStep(
        automation_id=auto.id,
        step_type=StepType.add_tag,
        step_order=1,
        name="Tag as Warm Lead",
        config={"tag": "Warm Lead"},
        is_active=True
    )
    db.add(step1)
    
    # 3. Step 2: Delay
    step2 = AutomationStep(
        automation_id=auto.id,
        step_type=StepType.delay,
        step_order=2,
        name="Wait 2 Seconds",
        config={"seconds": 2},
        is_active=True
    )
    db.add(step2)
    
    # 4. Step 3: Send Message
    step3 = AutomationStep(
        automation_id=auto.id,
        step_type=StepType.send_message,
        step_order=3,
        name="Send Welcome Message",
        config={
            "message": "Hello {{name}}! Thank you for your interest. A representative will contact you shortly.",
            "target_type": "single"
        },
        is_active=True
    )
    db.add(step3)
    
    db.commit()
    print(f"Successfully created example automation! ID: {auto.id}")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
