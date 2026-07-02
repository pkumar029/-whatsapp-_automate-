import httpx
import sys

sys.stdout.reconfigure(encoding='utf-8')
try:
    r = httpx.get("http://localhost:7005/health", timeout=3.0)
    print("Status code:", r.status_code)
    print("Headers:", dict(r.headers))
    print("Body:", r.text)
except Exception as e:
    print("Error:", e)
