"""
Dynamic Data Resilience & Production-Readiness Test Suite
==========================================================
Validates that the Unified Godrej Warehouse Intelligence Platform is strictly
DATA-DRIVEN rather than DATASET-DRIVEN.

Tests:
  - State A: 22 events (15 High, 7 Med, 0 Crit, 0 Low)
  - State B: 5 events (1 Crit, 1 High, 2 Med, 1 Low, custom video & bay)
  - State C: 0 events (Empty database state, division-by-zero prevention, clean responses)
  - State D: Schema flexibility (null optional fields, unusual timestamps, custom behaviours, JSON evidence)

Uses an isolated in-memory SQLite database via FastAPI dependency override to guarantee
the production database is never modified or contaminated.
"""

import json
import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import Base, get_db
from app.db import models
from app.services.event_adapter import EventAdapter


@pytest.fixture(scope="module")
def test_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="module")
def TestSessionLocal(test_engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="module")
def client(test_engine, TestSessionLocal):
    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    
    # Initialize basic tenancy in test DB
    db = TestSessionLocal()
    org = models.Organization(id="ORG-TEST", name="Test Global Logistics")
    db.add(org)
    fac = models.Facility(id="FAC-001", organization_id="ORG-TEST", name="Test Distribution Hub")
    db.add(fac)
    cam = models.Camera(id="CAM-01", name="Dock Cam 1", camera_code="DC-01")
    db.add(cam)
    user = models.User(
        id="USR-TEST-01",
        email="supervisor@wms-intel.io",
        full_name="Test Supervisor",
        role="SUPERVISOR",
        facility_id="FAC-001",
        hashed_password="test-hash"
    )
    db.add(user)
    db.commit()
    db.close()

    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    from app.core.security import create_access_token
    token = create_access_token(
        data={
            "sub": "USR-TEST-01",
            "email": "supervisor@wms-intel.io",
            "role": "SUPERVISOR",
            "facility_id": "FAC-001"
        },
        expires_delta=datetime.timedelta(minutes=60)
    )
    return {"Authorization": f"Bearer {token}"}


def clear_events(db):
    db.query(models.RiskAssessment).delete()
    db.query(models.BehaviourObservation).delete()
    db.query(models.Event).delete()
    db.query(models.InferenceRun).delete()
    db.query(models.Video).delete()
    db.commit()


# ==============================================================================
# STATE C: 0 EVENTS (EMPTY DATABASE STATE)
# ==============================================================================

def test_state_c_zero_events(client, auth_headers, TestSessionLocal):
    """
    Validates State C: Zero events in the database.
    Verifies that all API endpoints, analytics, and assistant return clean, valid
    responses without dividing by zero, failing, or throwing 500 errors.
    """
    db = TestSessionLocal()
    clear_events(db)
    db.close()

    # 1. GET /api/events must return an empty list []
    res_events = client.get("/api/events", headers=auth_headers)
    assert res_events.status_code == 200
    events = res_events.json()
    assert isinstance(events, list)
    assert len(events) == 0

    # 2. GET /api/analytics/summary must calculate 0 without division by zero
    res_summary = client.get("/api/analytics/summary", headers=auth_headers)
    assert res_summary.status_code == 200
    summary = res_summary.json()["summary"]
    assert summary["totalEvents"] == 0
    assert summary["criticalEvents"] == 0
    assert summary["highRiskEvents"] == 0
    assert summary["mediumRiskEvents"] == 0
    assert summary["lowRiskEvents"] == 0
    assert summary["activeIncidents"] == 0
    assert summary["resolvedIncidents"] == 0
    assert summary["preventionIndex"] == 100.0
    assert summary["repeatBehaviourPct"] == 0.0

    # 3. GET /api/analytics/behaviours must return empty list []
    res_beh = client.get("/api/analytics/behaviours", headers=auth_headers)
    assert res_beh.status_code == 200
    assert res_beh.json() == []

    # 4. GET /api/analytics/risk must return empty list []
    res_risk = client.get("/api/analytics/risk", headers=auth_headers)
    assert res_risk.status_code == 200
    assert res_risk.json() == []

    # 5. GET /api/analytics/timeline must return empty list []
    res_tl = client.get("/api/analytics/timeline", headers=auth_headers)
    assert res_tl.status_code == 200
    assert res_tl.json() == []

    # 6. AI Assistant must handle empty state gracefully
    res_chat = client.post(
        "/api/assistant/chat",
        json={"question": "What incidents occurred today?"},
        headers=auth_headers
    )
    assert res_chat.status_code == 200
    chat_resp = res_chat.json()
    assert chat_resp["retrieval_count"] == 0
    ans_lower = chat_resp["answer"].lower()
    assert ("no incidents" in ans_lower or "no verified" in ans_lower or "zero" in ans_lower or "0" in ans_lower)


# ==============================================================================
# STATE B: 5 EVENTS WITH DIVERSE RISK DISTRIBUTION & CUSTOM VIDEO
# ==============================================================================

def test_state_b_five_events_diverse_distribution(client, auth_headers, TestSessionLocal):
    """
    Validates State B: Exactly 5 events:
      - 1 Critical
      - 1 High
      - 2 Medium
      - 1 Low
    With custom video ID 'VID-CUSTOM-B99' and custom loading bay 'Loading Bay 99'.
    Verifies that counts, analytics, risk distributions, and filters adapt dynamically.
    """
    db = TestSessionLocal()
    clear_events(db)

    adapter = EventAdapter(default_org_id="ORG-TEST", default_facility_id="FAC-001")
    vid = adapter.resolve_video(db, video_name_or_id="custom_surveillance_feed_b99.mp4", duration=120.0, camera_id="CAM-01")

    events_to_insert = [
        {"id": "EVT-B-CRIT-01", "behaviour": "Forklift Collision Hazard", "risk_level": "CRITICAL", "risk_score": 95.0, "ts": 10.0, "bay": "Loading Bay 99"},
        {"id": "EVT-B-HIGH-01", "behaviour": "Product Dropped Mid-Air", "risk_level": "HIGH", "risk_score": 78.0, "ts": 25.0, "bay": "Loading Bay 99"},
        {"id": "EVT-B-MED-01", "behaviour": "Rough Carton Placement", "risk_level": "MEDIUM", "risk_score": 55.0, "ts": 40.0, "bay": "Loading Bay 99"},
        {"id": "EVT-B-MED-02", "behaviour": "Improper Stacking", "risk_level": "MEDIUM", "risk_score": 48.0, "ts": 55.0, "bay": "Loading Bay 99"},
        {"id": "EVT-B-LOW-01", "behaviour": "Slight Package Jitter", "risk_level": "LOW", "risk_score": 25.0, "ts": 70.0, "bay": "Loading Bay 99"},
    ]

    for ev in events_to_insert:
        adapter.adapt_and_persist_event(
            db=db,
            root_event={
                "event_id": ev["id"],
                "behaviour": ev["behaviour"],
                "risk_level": ev["risk_level"],
                "risk_score": ev["risk_score"],
                "timestamp": ev["ts"],
                "duration": 2.5,
                "bay_id": ev["bay"],
                "camera_id": "CAM-01",
                "description": f"Observed {ev['behaviour']} in test suite",
                "evidence": {"risk_factors": {"speed": 4.2}}
            },
            video_record=vid
        )
    db.close()

    # 1. GET /api/events must return exactly 5 events
    res_events = client.get("/api/events", headers=auth_headers)
    assert res_events.status_code == 200
    events = res_events.json()
    assert len(events) == 5

    # 2. Risk filter queries must dynamically filter
    res_crit = client.get("/api/events?risk_level=Critical", headers=auth_headers)
    assert len(res_crit.json()) == 1
    assert res_crit.json()[0]["event_id"] == "EVT-B-CRIT-01"

    res_med = client.get("/api/events?risk_level=Medium", headers=auth_headers)
    assert len(res_med.json()) == 2

    # Bay filter query
    res_bay = client.get("/api/events?bay_id=Loading%20Bay%2099", headers=auth_headers)
    assert len(res_bay.json()) == 5

    # 3. GET /api/analytics/summary must match State B math
    res_summary = client.get("/api/analytics/summary", headers=auth_headers)
    assert res_summary.status_code == 200
    summary = res_summary.json()["summary"]
    assert summary["totalEvents"] == 5
    assert summary["criticalEvents"] == 1
    assert summary["highRiskEvents"] == 1
    assert summary["mediumRiskEvents"] == 2
    assert summary["lowRiskEvents"] == 1
    assert summary["activeIncidents"] == 5

    # Expected prevention index:
    # penalty = (1 * 15) + (1 * 8) + (2 * 3) + (1 * 1) = 30
    # base_score = 100.0 - (30 / 5 * 5.0) = 100.0 - 30.0 = 70.0
    assert summary["preventionIndex"] == 70.0

    # 4. Assistant grounding in State B
    res_chat = client.post(
        "/api/assistant/chat",
        json={"question": "What is the critical risk event?"},
        headers=auth_headers
    )
    assert res_chat.status_code == 200
    chat_resp = res_chat.json()
    assert chat_resp["retrieval_count"] >= 1
    citation_ids = [c["event_id"] for c in chat_resp["citations"]]
    assert "EVT-B-CRIT-01" in citation_ids


# ==============================================================================
# STATE A: 22 EVENTS CANONICAL TEST FIXTURE (15 High, 7 Med, 0 Crit, 0 Low)
# ==============================================================================

def test_state_a_canonical_fixture_distribution(client, auth_headers, TestSessionLocal):
    """
    Validates State A: 22 events matching the canonical baseline:
      - 15 High
      - 7 Medium
      - 0 Critical
      - 0 Low
    """
    db = TestSessionLocal()
    clear_events(db)

    adapter = EventAdapter(default_org_id="ORG-TEST", default_facility_id="FAC-001")
    vid = adapter.resolve_video(db, video_name_or_id="Dock level, dragging cupboard.mp4", duration=60.0)

    # Insert 15 High events
    for i in range(1, 16):
        adapter.adapt_and_persist_event(
            db=db,
            root_event={
                "event_id": f"EVT-A-HIGH-{i:02d}",
                "behaviour": "Product Dragged",
                "risk_level": "HIGH",
                "risk_score": 75.0,
                "timestamp": float(i * 2),
                "duration": 1.5,
                "bay_id": "Loading Bay 1"
            },
            video_record=vid
        )

    # Insert 7 Medium events
    for j in range(1, 8):
        adapter.adapt_and_persist_event(
            db=db,
            root_event={
                "event_id": f"EVT-A-MED-{j:02d}",
                "behaviour": "Rough Handling",
                "risk_level": "MEDIUM",
                "risk_score": 50.0,
                "timestamp": float(35 + j * 2),
                "duration": 1.2,
                "bay_id": "Loading Bay 2"
            },
            video_record=vid
        )
    db.close()

    res_summary = client.get("/api/analytics/summary", headers=auth_headers)
    assert res_summary.status_code == 200
    summary = res_summary.json()["summary"]
    assert summary["totalEvents"] == 22
    assert summary["highRiskEvents"] == 15
    assert summary["mediumRiskEvents"] == 7
    assert summary["criticalEvents"] == 0
    assert summary["lowRiskEvents"] == 0


# ==============================================================================
# STATE D: SCHEMA FLEXIBILITY & RESILIENCE WITH OPTIONAL/NULL FIELDS
# ==============================================================================

def test_state_d_schema_flexibility(client, auth_headers, TestSessionLocal):
    """
    Validates State D: Events with missing/null optional fields, novel behaviour names,
    unusual timestamps, and custom JSON evidence structures.
    Verifies that the API serializes them smoothly and event detail endpoints function correctly.
    """
    db = TestSessionLocal()
    clear_events(db)

    adapter = EventAdapter(default_org_id="ORG-TEST", default_facility_id="FAC-001")
    vid = adapter.resolve_video(db, video_name_or_id="novel_feed_2026.mp4", duration=90.0)

    # Event with null optional fields and novel behaviour name
    adapter.adapt_and_persist_event(
        db=db,
        root_event={
            "event_id": "EVT-D-MINIMAL-01",
            "behaviour": "Autonomous Drone Proximity Hazard",
            "risk_level": "LOW",
            "risk_score": 15.0,
            "timestamp": 0.05,
            "duration": 0.1,
            "description": None,
            "reason": None,
            "recommended_action": None,
            "evidence": {"complex_metrics": {"vector_x": 0.12, "active_tags": ["drone", "aisle-4"]}}
        },
        video_record=vid
    )
    db.close()

    # 1. Verify retrieval from /api/events
    res = client.get("/api/events", headers=auth_headers)
    assert res.status_code == 200
    evts = res.json()
    assert len(evts) == 1
    evt = evts[0]
    assert evt["event_id"] == "EVT-D-MINIMAL-01"
    assert evt["behaviour"] == "Autonomous Drone Proximity Hazard"
    assert evt["risk_level"] in ["Low", "LOW"]

    # 2. Verify single incident retrieval
    res_single = client.get("/api/events/EVT-D-MINIMAL-01", headers=auth_headers)
    assert res_single.status_code == 200
    assert res_single.json()["event_id"] == "EVT-D-MINIMAL-01"

    # 3. Verify CSV export works with minimal fields
    res_csv = client.get("/api/events/export/csv", headers=auth_headers)
    assert res_csv.status_code == 200
    csv_text = res_csv.text
    assert "EVT-D-MINIMAL-01" in csv_text
    assert "Autonomous Drone Proximity Hazard" in csv_text
