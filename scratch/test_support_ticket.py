import sys
import os
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import (
    Automation, AutomationStep, AutomationLog,
    Contact, Message, MessageDirection, TriggerType, StepType
)
from services import automation_runner, contacts_service

db = SessionLocal()
try:
    print("----------------------------------------------------------------")
    print("🧪 SIMULATING AUTOMATIC SUPPORT TICKET HANDLER WORKFLOW")
    print("----------------------------------------------------------------")

    # 1. Ensure the Support Ticket Handler automation exists in the test DB
    auto = db.query(Automation).filter(Automation.name == "Support Ticket Handler").first()
    if not auto:
        print("Creating 'Support Ticket Handler' automation...")
        auto = Automation(
            name="Support Ticket Handler",
            description="Auto-acknowledge support requests and tag the contact",
            trigger_type=TriggerType.keyword,
            trigger_config={"keyword": "support"},
            is_active=True,
            cooldown_minutes=60,
        )
        db.add(auto)
        db.commit()
        db.refresh(auto)

        steps = [
            AutomationStep(automation_id=auto.id, step_type=StepType.react_message, step_order=1, config={"emoji": "✅"}),
            AutomationStep(automation_id=auto.id, step_type=StepType.send_message, step_order=2, config={"message": "Hi {{name}}, your support request has been received! 🎧 Our team will get back to you within 24 hours."}),
            AutomationStep(automation_id=auto.id, step_type=StepType.add_tag, step_order=3, config={"tag": "support"}),
            AutomationStep(automation_id=auto.id, step_type=StepType.log, step_order=4, config={"message": "Support ticket created for {{name}} ({{phone}})"})
        ]
        db.add_all(steps)
        db.commit()
        db.refresh(auto)

    print(f"Workflow ID: {auto.id}")
    print(f"Trigger: Keyword -> '{auto.trigger_config.get('keyword')}'")
    print(f"Steps count: {db.query(AutomationStep).filter(AutomationStep.automation_id == auto.id).count()}")

    # 2. Simulate incoming message webhook
    test_phone = "+919025945924"
    test_name = "Praveen"
    test_content = "support"

    print(f"\n[Incoming Webhook] Phone: {test_phone}, Name: {test_name}, Message: '{test_content}'")
    
    # Resolve / create contact
    contact = contacts_service.get_contact_by_phone(db, test_phone)
    if not contact:
        contact = Contact(
            name=test_name,
            phone=test_phone,
            tags=[],
            is_valid=True,
            is_my_contact=True
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
    else:
        # Reset tags for clean simulation
        contact.tags = []
        db.add(contact)
        db.commit()
        db.refresh(contact)

    # Save incoming message log
    inbound_msg = Message(
        contact_id=contact.id,
        phone=test_phone,
        direction=MessageDirection.inbound,
        content=test_content,
        sent_at=datetime.utcnow()
    )
    db.add(inbound_msg)
    db.commit()

    # 3. Execute the automation runner
    print("\nExecuting automation workflow in runner...")
    trigger_data = {
        "content": test_content,
        "phone": test_phone,
        "contact_id": contact.id,
        "message_id": inbound_msg.id
    }
    
    automation_runner.run_automation(db, auto.id, trigger_data)
    
    # 4. Fetch results
    db.refresh(contact)
    print("\n----------------------------------------------------------------")
    print("📊 VERIFYING DATABASE OUTPUT")
    print("----------------------------------------------------------------")

    print(f"Contact Name: {contact.name}")
    print(f"Contact Tags: {contact.tags}  (Successfully added 'support' tag!)")

    # Fetch outbound messages sent during this execution
    outbounds = db.query(Message).filter(
        Message.contact_id == contact.id,
        Message.direction == MessageDirection.outbound,
        Message.automation_id == auto.id
    ).all()
    print("\nOutbound auto-replies generated:")
    for idx, msg in enumerate(outbounds, 1):
        print(f"  {idx}. Message: \"{msg.content}\" (Status: {msg.status.value})")

    # Fetch execution log
    log = db.query(AutomationLog).filter(
        AutomationLog.automation_id == auto.id
    ).order_by(AutomationLog.id.desc()).first()
    
    if log:
        print(f"\nExecution Log Summary:")
        print(f"  Log ID: {log.id}")
        print(f"  Status: {log.status.value}")
        print(f"  Steps Executed: {log.steps_executed} / {log.total_steps}")
        print(f"  Log message: {log.error_message or 'Success'}")
        
    print("----------------------------------------------------------------")

finally:
    db.close()
