import httpx

url = "http://localhost:7001/api/v1/automations/19/run?dry_run=true"

try:
    print(f"Triggering Dry Run for Automation 19 via POST {url} ...")
    r = httpx.post(url, timeout=10.0)
    print(f"Status Code: {r.status_code}")
    res = r.json()
    print("\nDry Run Output Response:")
    print("-" * 50)
    print(f"Success: {res.get('success')}")
    print(f"Dry Run: {res.get('dry_run')}")
    print(f"Status: {res.get('status')}")
    print(f"Steps Simulated: {res.get('steps_simulated')}")
    print("\nSimulation Log Output:")
    print(res.get('log_output'))
    print("-" * 50)
except Exception as e:
    print(f"Request failed: {e}")
