import httpx

try:
    print("Sending request to http://localhost:8000/api/v1/contacts/chats ...")
    r = httpx.get("http://localhost:8000/api/v1/contacts/chats", timeout=10.0)
    print(f"Status Code: {r.status_code}")
    print(f"Headers: {dict(r.headers)}")
    print(f"Content: {r.text[:500]}")
except Exception as e:
    print(f"Request failed: {e}")
