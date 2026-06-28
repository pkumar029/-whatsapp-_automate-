import urllib.request
import urllib.parse
import json

base_url = "http://localhost:8000/api/v1/automations"

def test_create():
    payload = {
        "name": "Test Script Automation",
        "description": "Created by testing script",
        "trigger_type": "schedule",
        "trigger_config": {
            "cron": "*/5 * * * *"
        },
        "steps": [
            {
                "step_type": "send_message",
                "name": "Test Send",
                "config": {
                    "message": "Hello!",
                    "target_type": "single",
                    "phone": "919876543210"
                }
            }
        ]
    }
    
    try:
        # Create
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(base_url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req) as res:
            body = json.loads(res.read().decode('utf-8'))
            print("Create status:", res.status)
            print("Create body:", body)
            auto_id = body.get("id")
            
        if auto_id:
            # Update
            payload["name"] = "Test Script Automation Updated"
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(f"{base_url}/{auto_id}", data=data, headers={'Content-Type': 'application/json'}, method='PUT')
            with urllib.request.urlopen(req) as res:
                body = json.loads(res.read().decode('utf-8'))
                print("Update status:", res.status)
                print("Update body:", body)
                
            # Delete
            req = urllib.request.Request(f"{base_url}/{auto_id}", method='DELETE')
            with urllib.request.urlopen(req) as res:
                print("Delete status:", res.status)
                
    except Exception as e:
        print("Test failed with exception:", e)

if __name__ == "__main__":
    test_create()
