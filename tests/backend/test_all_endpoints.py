import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app

def test_all_endpoints():
    client = TestClient(app)

    # 1. Health
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health failed: {res.text}"
    assert res.json().get("status") == "healthy"

    # 2. Videos
    res = client.get("/api/videos")
    assert res.status_code == 200, f"Videos failed: {res.text}"
    videos = res.json()
    assert isinstance(videos, list)
    if videos:
        vid_id = videos[0]["video_id"]
        res_single = client.get(f"/api/videos/{vid_id}")
        assert res_single.status_code == 200

    # 3. Events
    res = client.get("/api/events")
    assert res.status_code == 200, f"Events failed: {res.text}"
    events = res.json()
    assert isinstance(events, list)
    if events:
        evt_id = events[0]["event_id"]
        res_single = client.get(f"/api/events/{evt_id}")
        assert res_single.status_code == 200

    # 4. Events Filtered & Export CSV
    res_csv = client.get("/api/events/export/csv?risk_level=Critical")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers.get("content-type", "")

    # 5. Analytics
    res = client.get("/api/analytics/summary")
    assert res.status_code == 200
    assert "summary" in res.json()

    res = client.get("/api/analytics/behaviours")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    res = client.get("/api/analytics/risk")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    res = client.get("/api/analytics/timeline")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # 6. Assistant Chat
    res = client.post("/api/assistant/chat", json={"question": "What is the critical risk event?"})
    assert res.status_code == 200
    assert "answer" in res.json()

    print("ALL API ENDPOINTS TESTED AND PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_all_endpoints()
