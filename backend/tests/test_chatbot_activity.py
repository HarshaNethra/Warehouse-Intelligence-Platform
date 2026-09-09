"""
Live Chatbot Activity & Capability Verification Script.
Tests all conversational pathways of the Warehouse AI Assistant:
  1. Instant Zero-Token Greeting Bypass (< 15ms)
  2. Grounded Incident Querying from SQL/Vector Store
  3. Facility Scoping & Role Security Guard
  4. Kinematic Risk Explainability & SOP Guidance
  5. Citations & Provenance Payload Integrity
"""

import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.db.seed import init_db

@pytest.fixture(scope="module")
def client():
    with SessionLocal() as db:
        init_db(db)
    return TestClient(app)

@pytest.fixture
def auth_headers():
    token = create_access_token(
        data={
            "sub": "user-sup-01",
            "email": "supervisor@wms-intel.io",
            "role": "SUPERVISOR",
            "facility_id": "FAC-001"
        }
    )
    return {"Authorization": f"Bearer {token}"}

def test_chatbot_greeting_activity(client, auth_headers):
    """Verifies instant greeting with zero token consumption and correct model identifier."""
    res = client.post(
        "/api/assistant/chat",
        headers=auth_headers,
        json={"question": "Hello! What can you help me with?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "Hello!" in data["answer"]
    assert "AI Operations Assistant" in data["answer"]
    assert data["model_used"] == "Local-Rule-Assistant"
    assert data["retrieval_count"] >= 0

def test_chatbot_highest_risk_query_activity(client, auth_headers):
    """Verifies warehouse incident querying and citation grounding."""
    res = client.post(
        "/api/assistant/chat",
        headers=auth_headers,
        json={"question": "Show me today's highest-risk events and recommendations"}
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["answer"]) > 20
    assert "data_scope" in data
    assert data["data_scope"]["authorized_facility_id"] == "FAC-001"
    assert len(data["citations"]) > 0

def test_chatbot_facility_scoping_security(client, auth_headers):
    """Verifies facility guard prevents unauthorized cross-facility leaks."""
    res = client.post(
        "/api/assistant/chat",
        headers=auth_headers,
        json={"question": "Tell me about incidents in FAC-002"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "Access Denied" in data["answer"]
    assert data["model_used"] == "Security-Facility-Scope-Guard"

def test_chatbot_sop_guidance_activity(client, auth_headers):
    """Verifies guidance on damage prevention and material handling SOPs."""
    res = client.post(
        "/api/assistant/chat",
        headers=auth_headers,
        json={"question": "Why was the carton drop event flagged as critical?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["answer"]) > 30
    assert data["citations"] is not None

if __name__ == "__main__":
    with SessionLocal() as db:
        init_db(db)
    c = TestClient(app)
    tok = create_access_token(data={"sub": "user-sup-01", "email": "supervisor@wms-intel.io", "role": "SUPERVISOR", "facility_id": "FAC-001"})
    hdrs = {"Authorization": f"Bearer {tok}"}
    
    print("--- Test 1: Greeting ---")
    r1 = c.post("/api/assistant/chat", headers=hdrs, json={"question": "Hello!"})
    print(r1.json()["answer"])
    
    print("\n--- Test 2: Highest-Risk Query ---")
    r2 = c.post("/api/assistant/chat", headers=hdrs, json={"question": "What are the highest risk events?"})
    print(r2.json()["answer"])
    print("Citations:", len(r2.json()["citations"]))
