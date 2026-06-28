import httpx

try:
    print("Sending request to http://localhost:3000/chats ...")
    r = httpx.get("http://localhost:3000/chats", timeout=10.0)
    print(f"Status Code: {r.status_code}")
    print(f"Headers: {dict(r.headers)}")
    print(f"Content: {r.text}")
except Exception as e:
    print(f"Request failed: {e}")
