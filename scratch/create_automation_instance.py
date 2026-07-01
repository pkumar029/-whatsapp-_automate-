import sys
import os
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Automation, AutomationStep, TriggerType, StepType

db = SessionLocal()
try:
    print("----------------------------------------------------------------")
    print("🤖 SEEDING ACTIVE AUTOMATIC WORKFLOW TEMPLATE")
    print("----------------------------------------------------------------")

    # Disable other automations first for clean testing
    db.query(Automation).update({Automation.is_active: False})
    db.commit()

    # Create new active Hello Auto-Reply automation
    auto = Automation(
        name="Auto-Reply Hello",
        description="Greets users, reacts, and tags them automatically on hello",
        trigger_type=TriggerType.keyword,
        trigger_config={"keyword": "hello"},
        is_active=True,
        cooldown_minutes=1
    )
    db.add(auto)
    db.commit()
    db.refresh(auto)

    steps = [
        AutomationStep(
            automation_id=auto.id,
            step_type=StepType.react_message,
            step_order=1,
            config={"emoji": "👋"}
        ),
        AutomationStep(
            automation_id=auto.id,
            step_type=StepType.send_message,
            step_order=2,
            config={"message": "Hello {{name}}! 👋 Thank you for messaging. How can we help you today?"}
        ),
        AutomationStep(
            automation_id=auto.id,
            step_type=StepType.add_tag,
            step_order=3,
            config={"tag": "greeted"}
        ),
        AutomationStep(
            automation_id=auto.id,
            step_type=StepType.log,
            step_order=4,
            config={"message": "Greeted user {{name}}"}
        )
    ]
    db.add_all(steps)
    db.commit()
    db.refresh(auto)

    print(f"✅ Created Active Automation: '{auto.name}' (ID: {auto.id})")
    print(f"  Trigger: Keyword -> '{auto.trigger_config.get('keyword')}'")
    print("  Steps registered:")
    for step in sorted(auto.steps, key=lambda s: s.step_order):
        print(f"    Step {step.step_order}: {step.step_type.value} -> config: {step.config}")
    print("----------------------------------------------------------------")

except Exception as e:
    db.rollback()
    print(f"Error seeding automation: {e}")
finally:
    db.close()
