import snowflake.connector
import requests
import urllib3
import json

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Connect to Snowflake
conn = snowflake.connector.connect(connection_name='fr43183')
session_token = conn._rest._token

base_url = "https://mafdxb-ziaihbo-fr43183.snowflakecomputing.app"
headers = {
    "Authorization": f"Snowflake Token=\"{session_token}\""
}

endpoints = [
    "/api/health",
    "/api/exceptions",
    "/api/trades",
    "/api/counterparties/CP-192",
    "/api/settlement-events/TRD-92831"
]

print("Testing GET endpoints:")
for ep in endpoints:
    url = base_url + ep
    resp = requests.get(url, headers=headers)
    print(f"{ep} - {resp.status_code}")
    if resp.status_code == 200:
        try:
            print("  ", str(resp.json())[:200])
        except:
            print("  ", resp.text[:200])
    else:
        print("  ", resp.text[:200])

print("\nTesting Cortex Search:")
resp = requests.post(base_url + "/api/cortex/search", headers=headers, json={"query": "test"})
print("/api/cortex/search -", resp.status_code)

print("\nTesting Cortex Analyst:")
payload = {
    "question": "Show me trade TRD-92831 with its trade value, settlement status, instruction status, risk score, and exception type."
}
resp = requests.post(base_url + "/api/cortex/analyst", headers=headers, json=payload)
print("/api/cortex/analyst -", resp.status_code)
if resp.status_code == 200:
    try:
        print("  ", json.dumps(resp.json(), indent=2))
    except:
        print("  ", resp.text[:1000])
else:
    print("  ", resp.text[:1000])
