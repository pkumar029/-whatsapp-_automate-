import httpx
import sys

sys.stdout.reconfigure(encoding='utf-8')
try:
    r = httpx.get("https://wa-api.tamix.in/health", timeout=5.0)
    print("Status code:", r.status_code)
    print("Body:", r.text)
except Exception as e:
    print("Error:", e)
