import httpx

try:
    print("Sending POST to http://localhost:7001/api/v1/messages/sync ...")
    r = httpx.post("http://localhost:7001/api/v1/messages/sync", timeout=10.0)
    print(f"Status Code: {r.status_code}")
    print(f"Response: {r.text}")
except Exception as e:
    print(f"Request failed: {e}")
