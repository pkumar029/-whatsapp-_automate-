import httpx

for method in ["GET", "POST", "PUT", "DELETE"]:
    for url in ["http://localhost:7001/api/v1/messages/sync", "http://localhost:7001/api/v1/messages/sync/"]:
        try:
            r = httpx.request(method, url, timeout=5.0)
            print(f"{method} {url} -> {r.status_code} {r.text[:100]}")
        except Exception as e:
            print(f"{method} {url} failed: {e}")
