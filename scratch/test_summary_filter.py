import httpx

try:
    print("Requesting dashboard summary from http://localhost:8000/api/v1/dashboard/summary ...")
    r = httpx.get("http://localhost:8000/api/v1/dashboard/summary", timeout=10.0)
    print(f"Status Code: {r.status_code}")
    print(f"Content: {r.json()}")
except Exception as e:
    print(f"Request failed: {e}")
