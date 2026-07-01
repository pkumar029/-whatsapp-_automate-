import sys
import os
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Contact, Message, MessageDirection, MessageStatus, AutomationLog, Automation
from services.automation_runner import run_automation

db = SessionLocal()
try:
    print("----------------------------------------------------------------")
    print("🚀 RUNNING AUTOMATION SIMULATOR FOR 'hello'")
    print("----------------------------------------------------------------")

    # Fetch/create test contact
    contact = db.query(Contact).filter(Contact.phone == "+919025945924").first()
    if not contact:
        contact = Contact(name="Praveen Test", phone="+919025945924", tags=[])
        db.add(contact)
        db.commit()
        db.refresh(contact)

    # Inbound message that triggers the automation
    inbound_msg = Message(
        contact_id=contact.id,
        phone=contact.phone,
        direction=MessageDirection.inbound,
        content="hello",
        status=MessageStatus.read,
        whatsapp_message_id="test_msg_id_hello_123",
        created_at=datetime.utcnow()
    )
    db.add(inbound_msg)
    db.commit()
    db.refresh(inbound_msg)

    print(f"Trigger message created! Content: '{inbound_msg.content}'")

    # Query the auto
    auto = db.query(Automation).filter(Automation.name == "Auto-Reply Hello").first()

    # Trigger data structure
    trigger_data = {
        "phone": inbound_msg.phone,
        "content": inbound_msg.content,
        "contact_id": contact.id,
        "whatsapp_message_id": inbound_msg.whatsapp_message_id
    }

    # Run automation runner
    run_automation(db, auto.id, trigger_data)
    db.commit()
    
    # Query logs
    auto = db.query(Automation).filter(Automation.name == "Auto-Reply Hello").first()
    log = db.query(AutomationLog).filter(AutomationLog.automation_id == auto.id).order_by(AutomationLog.id.desc()).first()
    
    print("\n----------------------------------------------------------------")
    print("📊 EXECUTION LOG RESULT")
    print("----------------------------------------------------------------")
    if log:
        print(f"Log ID: {log.id}")
        print(f"Workflow Status: {log.status.value}")
        print(f"Steps Executed: {log.steps_executed} / {log.total_steps}")
        print(f"Error Message: {log.error_message or 'None'}")
        print(f"Log Output:\n{log.log_output}")
    else:
        print("No log generated.")
    print("----------------------------------------------------------------")

except Exception as e:
    db.rollback()
    print(f"Error running automation: {e}")
finally:
    db.close()
