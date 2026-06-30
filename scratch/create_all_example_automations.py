import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.connection import SessionLocal
from models.models import Automation, AutomationStep, TriggerType, StepType

db = SessionLocal()
try:
    print("Populating database with representative examples for all 8 Trigger Types...")

    examples = [
        # 1. Exact Keyword
        {
            "name": "Auto-Reply: exact keyword 'HELP'",
            "description": "Triggered when a contact messages 'help' exactly. Sends directory instructions.",
            "trigger_type": TriggerType.keyword,
            "trigger_config": {"keyword": "help"},
            "steps": [
                {
                    "step_order": 1,
                    "step_type": StepType.send_message,
                    "name": "Send Directory",
                    "config": {
                        "message": "Need help? Reply with INFO for business hours, PRICING for rates, or SUPPORT for tech issues.",
                        "target_type": "single"
                    }
                }
            ]
        },
        # 2. Keyword Pattern
        {
            "name": "Auto-Reply: pattern 'pricing'",
            "description": "Triggered when message contains 'price' or 'cost'. Replies with pricing links.",
            "trigger_type": TriggerType.keyword_pattern,
            "trigger_config": {"pattern": "price", "match_mode": "contains"},
            "steps": [
                {
                    "step_order": 1,
                    "step_type": StepType.send_message,
                    "name": "Send Pricing Details",
                    "config": {
                        "message": "Our pricing plans start at $19/mo. Read details here: website.com/pricing",
                        "target_type": "single"
                    }
                }
            ]
        },
        # 3. Scheduled Check-in
        {
            "name": "Scheduled: Weekly Subscriber Check-in",
            "description": "Runs automatically every Monday morning to check in with subscribers.",
            "trigger_type": TriggerType.schedule,
            "trigger_config": {"cron": "0 9 * * 1"},
            "steps": [
                {
                    "step_order": 1,
                    "step_type": StepType.send_message,
                    "name": "Send Monday Check-in",
                    "config": {
                        "message": "Happy Monday! Hope you have a productive week ahead.",
                        "target_type": "group",
                        "target_tag": "all"
                    }
                }
            ]
        },
        # 4. Contact Added Welcome
        {
            "name": "Onboarding: Welcome new contacts",
            "description": "Triggered instantly when a new contact profile is added to the system.",
            "trigger_type": TriggerType.contact_added,
            "trigger_config": {},
            "steps": [
                {
                    "step_order": 1,
                    "step_type": StepType.send_message,
                    "name": "Send Welcome Message",
                    "config": {
                        "message": "Welcome {{name}}! Save this chat to get updates from our automation channel.",
                        "target_type": "single"
                    }
                }
            ]
        },
        # 5. Tag Applied Conversion
        {
            "name": "Onboarding: Convert lead to customer",
            "description": "Triggered when 'Customer' tag is applied. Removes the 'Lead' tag and sends a welcome pack.",
            "trigger_type": TriggerType.contact_tag_added,
            "trigger_config": {"tag": "Customer"},
            "steps": [
                {
                    "step_order": 1,
                    "step_type": StepType.remove_tag,
                    "name": "Remove Lead Tag",
                    "config": {"tag": "Lead"}
                },
                {
                    "step_order": 2,
                    "step_type": StepType.send_message,
                    "name": "Send Purchase Welcome Pack",
                    "config": {
                        "message": "Thank you for buying! Here is your onboarding link: website.com/welcome",
                        "target_type": "single"
                    }
                }
            ]
        },
        # 6. Any Message Auto-Response
        {
            "name": "Auto-Response: Receipt confirmation",
            "description": "Triggered on any incoming message. Confirms message receipt.",
            "trigger_type": TriggerType.message_received,
            "trigger_config": {},
            "steps": [
                {
                    "step_order": 1,
                    "step_type": StepType.send_message,
                    "name": "Confirm Receipt",
                    "config": {
                        "message": "Thanks for your message. We have received it and will reply shortly.",
                        "target_type": "single"
                    }
                }
            ]
        },
        # 7. Webhook confirmation
        {
            "name": "Integration: Stripe purchase confirmation",
            "description": "Triggered by Stripe webhooks to send immediate invoice details to customer.",
            "trigger_type": TriggerType.webhook_received,
            "trigger_config": {"token": "stripe_invoice_payment_succeeded"},
            "steps": [
                {
                    "step_order": 1,
                    "step_type": StepType.send_message,
                    "name": "Send Webhook Invoice Alert",
                    "config": {
                        "message": "Order confirmed! Tracking code: {{tracking_code}}",
                        "target_type": "single"
                    }
                }
            ]
        },
        # 8. Manual Broadcast
        {
            "name": "Manual: Maintenance notification",
            "description": "Run manually by admins to alert contacts about upcoming maintenance.",
            "trigger_type": TriggerType.manual,
            "trigger_config": {},
            "steps": [
                {
                    "step_order": 1,
                    "step_type": StepType.send_message,
                    "name": "Broadcast Maintenance Alert",
                    "config": {
                        "message": "We are undergoing system maintenance. Expect brief downtime tonight at 10 PM.",
                        "target_type": "single"
                    }
                }
            ]
        }
    ]

    for ex in examples:
        # Avoid duplicating by name
        existing = db.query(Automation).filter(Automation.name == ex["name"]).first()
        if existing:
            print(f"Skipping existing automation: {ex['name']}")
            continue
            
        auto = Automation(
            name=ex["name"],
            description=ex["description"],
            trigger_type=ex["trigger_type"],
            trigger_config=ex["trigger_config"],
            is_active=True,
            cooldown_minutes=1
        )
        db.add(auto)
        db.flush()
        
        for step_data in ex["steps"]:
            step = AutomationStep(
                automation_id=auto.id,
                step_type=step_data["step_type"],
                step_order=step_data["step_order"],
                name=step_data["name"],
                config=step_data["config"],
                is_active=True
            )
            db.add(step)
            
        print(f"Created automation: {auto.name}")

    db.commit()
    print("Successfully populated examples for all 8 trigger types!")
except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
