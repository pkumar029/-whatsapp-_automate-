import httpx

url = "http://localhost:7001/api/v1/contacts"

try:
    print(f"Testing GET {url} without params...")
    r = httpx.get(url, timeout=5.0)
    print(f"Status Code: {r.status_code}")
    print(f"Content: {r.text[:300]}")
    
    print(f"\nTesting GET {url} with limit=200...")
    r2 = httpx.get(url, params={"limit": 200}, timeout=5.0)
    print(f"Status Code: {r2.status_code}")
    print(f"Content: {r2.text[:300]}")

    print(f"\nTesting GET {url} with limit=300 & wa_account=917448582459...")
    r3 = httpx.get(url, params={"limit": 300, "wa_account": "917448582459"}, timeout=5.0)
    print(f"Status Code: {r3.status_code}")
    print(f"Content: {r3.text[:300]}")
except Exception as e:
    print(f"Request failed: {e}")
