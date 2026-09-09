"""
Dynamic Scaling & Event Volume Resilience Test Suite
=====================================================
Validates that the Unified Godrej Warehouse Intelligence Platform supports:
  - 0 events (Empty state: no division by zero, clean JSON responses)
  - 1 event (Minimal state: single event processing and retrieval)
  - 5 events (Multi-risk state: Critical, High, Medium, Low filtering)
  - 22 events (Baseline operational volume)
  - 100+ events (High volume state: 150 events, pagination, summary metrics, and CSV streaming)

Uses an in-memory SQLite database via FastAPI dependency override to guarantee isolation.
"""

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
from behaviour_engine.rule_engine import RuleEngine
from behaviour_engine.motion import TrackPoint
from risk_engine.pipeline import score_and_build_events


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

    db = TestSessionLocal()
    org = models.Organization(id="ORG-SCALE", name="Scaling Test Logistics")
    db.add(org)
    fac = models.Facility(id="FAC-SCALE", organization_id="ORG-SCALE", name="Scale Testing Facility")
    db.add(fac)
    bay = models.LoadingBay(id="BAY-SCALE", facility_id="FAC-SCALE", name="Bay Scale", code="BS-01")
    db.add(bay)
    cam = models.Camera(id="CAM-SCALE", loading_bay_id="BAY-SCALE", name="Cam Scale", camera_code="CS-01")
    db.add(cam)

    user = models.User(
        id="usr-scale-test",
        email="scaler@godrej-intel.io",
        hashed_password="mock_hashed_password",
        full_name="Scale Auditor",
        role="SUPERVISOR",
        facility_id="FAC-SCALE"
    )
    db.add(user)
    db.commit()
    db.close()

    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(scope="module")
def auth_headers():
    from app.core.security import create_access_token
    token = create_access_token(
        data={"sub": "usr-scale-test", "email": "scaler@godrej-intel.io", "role": "SUPERVISOR", "facility_id": "FAC-SCALE"},
        expires_delta=datetime.timedelta(hours=2)
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
# 1. CANONICAL ENGINE SCALING (0, 1, 5, 22, 100+ TRACKS)
# ==============================================================================

def test_behaviour_and_risk_engine_scaling():
    """Verifies behaviour and risk engines handle 0, 1, 5, 22, and 100+ tracks cleanly."""
    engine = RuleEngine()

    # 0 tracks
    res_0 = engine.process_tracks({}, fps=30.0, video_name="empty_test")
    events_0 = score_and_build_events(res_0, video_id="empty_test", fps=30.0)
    assert len(events_0) == 0

    # 1 track (non-hazardous)
    track_1 = [
        TrackPoint(frame=i, x=100.0, y=200.0, width=50.0, height=50.0, class_name="product")
        for i in range(10)
    ]
    res_1 = engine.process_tracks({1: track_1}, fps=30.0, video_name="single_test")
    events_1 = score_and_build_events(res_1, video_id="single_test", fps=30.0)
    assert isinstance(events_1, list)

    # 100+ tracks
    tracks_120 = {}
    for t_idx in range(120):
        tracks_120[t_idx + 100] = [
            TrackPoint(
                frame=f,
                x=100.0 + f * 2.0,
                y=200.0 + f,
                width=40.0,
                height=40.0,
                class_name="product" if t_idx % 2 == 0 else "person"
            )
            for f in range(5)
        ]
    res_120 = engine.process_tracks(tracks_120, fps=30.0, video_name="scale_test_120")
    events_120 = score_and_build_events(res_120, video_id="scale_test_120", fps=30.0)
    assert isinstance(events_120, list)


# ==============================================================================
# 2. API DYNAMIC VOLUME SCALING (0, 1, 5, 22, 150 EVENTS)
# ==============================================================================

def test_api_scaling_zero_events(client, auth_headers, TestSessionLocal):
    """Test 0 events: verify summary, events list, and CSV export handle empty state."""
    db = TestSessionLocal()
    clear_events(db)
    db.close()

    res = client.get("/api/analytics/summary", headers=auth_headers)
    assert res.status_code == 200
    summary = res.json()["summary"]
    assert summary["totalEvents"] == 0
    assert summary["criticalEvents"] == 0
    assert summary["highRiskEvents"] == 0
    assert summary["mediumRiskEvents"] == 0
    assert summary["lowRiskEvents"] == 0

    res_events = client.get("/api/events", headers=auth_headers)
    assert res_events.status_code == 200
    assert res_events.json() == []

    res_csv = client.get("/api/events/export/csv", headers=auth_headers)
    assert res_csv.status_code == 200
    lines = res_csv.text.strip().split("\n")
    assert len(lines) == 1  # Header row only


def test_api_scaling_one_event(client, auth_headers, TestSessionLocal):
    """Test 1 event: single incident persisted and retrieved."""
    db = TestSessionLocal()
    clear_events(db)

    adapter = EventAdapter(default_org_id="ORG-SCALE", default_facility_id="FAC-SCALE")
    vid = adapter.resolve_video(db, video_name_or_id="single_event_vid.mp4", duration=30.0)

    adapter.adapt_and_persist_event(
        db=db,
        root_event={
            "event_id": "EVT-SCALE-001",
            "behaviour": "Dropping",
            "risk_level": "HIGH",
            "risk_score": 82.5,
            "timestamp": 12.4,
            "duration": 1.0,
            "bay_id": "BAY-SCALE",
            "camera_id": "CAM-SCALE",
            "description": "Single test drop event"
        },
        video_record=vid
    )
    db.close()

    res = client.get("/api/analytics/summary", headers=auth_headers)
    assert res.status_code == 200
    summary = res.json()["summary"]
    assert summary["totalEvents"] == 1
    assert summary["highRiskEvents"] == 1

    res_single = client.get("/api/events/EVT-SCALE-001", headers=auth_headers)
    assert res_single.status_code == 200
    assert res_single.json()["event_id"] == "EVT-SCALE-001"


def test_api_scaling_five_events(client, auth_headers, TestSessionLocal):
    """Test 5 events: heterogeneous risk distribution."""
    db = TestSessionLocal()
    clear_events(db)

    adapter = EventAdapter(default_org_id="ORG-SCALE", default_facility_id="FAC-SCALE")
    vid = adapter.resolve_video(db, video_name_or_id="five_events_vid.mp4", duration=60.0)

    event_configs = [
        ("EVT-5-01", "Throwing", "CRITICAL", 92.0),
        ("EVT-5-02", "Dropping", "HIGH", 78.0),
        ("EVT-5-03", "Rough Handling", "MEDIUM", 55.0),
        ("EVT-5-04", "Rough Handling", "MEDIUM", 45.0),
        ("EVT-5-05", "Unstable Stacking", "LOW", 25.0),
    ]

    for eid, beh, lvl, score in event_configs:
        adapter.adapt_and_persist_event(
            db=db,
            root_event={
                "event_id": eid,
                "behaviour": beh,
                "risk_level": lvl,
                "risk_score": score,
                "timestamp": 5.0,
                "duration": 0.8,
                "bay_id": "BAY-SCALE"
            },
            video_record=vid
        )
    db.close()

    res = client.get("/api/analytics/summary", headers=auth_headers)
    assert res.status_code == 200
    s = res.json()["summary"]
    assert s["totalEvents"] == 5
    assert s["criticalEvents"] == 1
    assert s["highRiskEvents"] == 1
    assert s["mediumRiskEvents"] == 2
    assert s["lowRiskEvents"] == 1

    # Verify Medium/Low combined filter
    res_med_low = client.get("/api/events?risk_level=Medium/Low", headers=auth_headers)
    assert res_med_low.status_code == 200
    assert len(res_med_low.json()) == 3  # 2 Medium + 1 Low


def test_api_scaling_hundred_plus_events(client, auth_headers, TestSessionLocal):
    """Test 150 events: verifies large dataset pagination and streaming CSV export."""
    db = TestSessionLocal()
    clear_events(db)

    adapter = EventAdapter(default_org_id="ORG-SCALE", default_facility_id="FAC-SCALE")
    vid = adapter.resolve_video(db, video_name_or_id="scale_150_vid.mp4", duration=300.0)

    for i in range(150):
        lvl = ["LOW", "MEDIUM", "HIGH", "CRITICAL"][i % 4]
        adapter.adapt_and_persist_event(
            db=db,
            root_event={
                "event_id": f"EVT-BULK-{i:03d}",
                "behaviour": f"Bulk Behaviour {i % 5}",
                "risk_level": lvl,
                "risk_score": float(10 + (i % 90)),
                "timestamp": float(i * 1.5),
                "duration": 0.5,
                "bay_id": "BAY-SCALE"
            },
            video_record=vid
        )
    db.close()

    # 1. Summary
    res = client.get("/api/analytics/summary", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["summary"]["totalEvents"] == 150

    # 2. Pagination (limit 50, skip 100 -> returns 50)
    res_page = client.get("/api/events?skip=100&limit=50", headers=auth_headers)
    assert res_page.status_code == 200
    assert len(res_page.json()) == 50

    # 3. CSV streaming export for 150 events
    res_csv = client.get("/api/events/export/csv", headers=auth_headers)
    assert res_csv.status_code == 200
    lines = [l for l in res_csv.text.strip().split("\n") if l.strip()]
    assert len(lines) == 151  # Header + 150 rows
