import httpx

url = "http://localhost:7001/api/v1/contacts"

payloads = [
    # 1. Standard valid payload
    {"name": "Test User", "phone": "+919876543210"},
    # 2. Empty email string
    {"name": "Test User", "phone": "+919876543211", "email": ""},
    # 3. Invalid phone format (letters)
    {"name": "Test User", "phone": "abc123"},
    # 4. Too long phone number
    {"name": "Test User", "phone": "12345678901234567"},
    # 5. Empty name
    {"name": "", "phone": "+919876543212"},
    # 6. Group JID
    {"name": "Test Group", "phone": "120363028340915976@g.us"},
]

for idx, p in enumerate(payloads, 1):
    try:
        print(f"\n--- Testing Payload {idx}: {p} ---")
        r = httpx.post(url, json=p, timeout=5.0)
        print(f"Status Code: {r.status_code}")
        print(f"Response: {r.json()}")
    except Exception as e:
        print(f"Request failed: {e}")
