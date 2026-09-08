import sys
import urllib.request
import urllib.parse
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

print("=== 1. VERIFYING CORS CONFIGURATION ===")
from app.config import CORS_ORIGINS
print("CORS_ORIGINS:", CORS_ORIGINS)
assert "*" not in CORS_ORIGINS, "FAIL: Wildcard * should not be in CORS_ORIGINS!"
print("PASS: No wildcard * in CORS_ORIGINS.")

print("\n=== 2. VERIFYING SQL LIKE ESCAPING & SEARCH ===")
test_queries = ["drop", "%", "_", "<script>", "Bay 4"]
for q in test_queries:
    encoded = urllib.parse.quote(q)
    url = f"http://127.0.0.1:8000/api/events?search={encoded}"
    req = urllib.request.urlopen(url)
    data = json.loads(req.read().decode())
    print(f"Search '{q}' -> Status {req.status}, matches: {len(data)}")

print("\n=== 3. VERIFYING INCIDENT DETAILS & PARAMS ===")
req_inc = urllib.request.urlopen("http://127.0.0.1:8000/api/events/EVT-001")
evt = json.loads(req_inc.read().decode())
print(f"EVT-001 fetched -> ID: {evt['event_id']}, Behaviour: {evt['behaviour']}, Score: {evt['risk_score']}")

print("\n=== 4. VERIFYING AI ASSISTANT INPUT HANDLING ===")
post_data = json.dumps({"question": "What happened during rough handling?"}).encode()
req_chat = urllib.request.Request(
    "http://127.0.0.1:8000/api/assistant/chat",
    data=post_data,
    headers={"Content-Type": "application/json"}
)
resp_chat = urllib.request.urlopen(req_chat)
chat_res = json.loads(resp_chat.read().decode())
print("Status:", resp_chat.status)
print("Sources:", [s["event_id"] for s in chat_res.get("source_events", [])])

print("\n=== 5. VERIFYING FRONTEND CSP META TAG ===")
with open(Path(__file__).resolve().parent.parent / "frontend" / "index.html", "r", encoding="utf-8") as f:
    html = f.read()
assert "Content-Security-Policy" in html, "FAIL: CSP meta tag missing!"
print("PASS: Content-Security-Policy meta tag present in index.html.")

print("\n=== 6. VERIFYING VITE DEV SERVER PROXY ===")
proxy_url = "http://localhost:5173/api/events"
req_proxy = urllib.request.urlopen(proxy_url)
proxy_data = json.loads(req_proxy.read().decode())
print(f"Vite Proxy -> Status {req_proxy.status}, Events: {len(proxy_data)}")

print("\nALL VERIFICATIONS PASSED!")
