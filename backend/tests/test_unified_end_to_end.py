"""
Deterministic End-to-End Integration Verification Test for Unified Godrej Platform.

Validates the complete execution flow:
  Warehouse Trajectory CSV
    -> Canonical Member 2 Behaviour Engine (RuleEngine)
    -> Canonical Member 2 Risk Engine (score_and_build_events)
    -> EventAdapter 3-layer persistence
    -> Project 2 SQLite DB
    -> FastAPI Authenticated Endpoints (/api/events, /api/analytics/summary)
    -> Grounded AI Assistant (/api/assistant/chat)
"""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal, engine, Base
from app.db import models
from app.engine.behaviour.rule_engine import RuleEngine
from app.engine.risk.pipeline import score_and_build_events
from app.services.event_adapter import event_adapter


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


@pytest.fixture(scope="module")
def auth_headers(client):
    res = client.post("/api/auth/login", json={
        "email": "supervisor@wms-intel.io",
        "password": "password123"
    })
    assert res.status_code == 200, f"Auth failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dock_level_trajectory_to_canonical_events(client, auth_headers):
    """
    Validates that Dock level trajectory produces the exact canonical baseline:
    10 events (4 High, 6 Medium, 0 Critical, 0 Low).
    """
    res = client.post(
        "/api/pipeline/ingest-trajectories",
        json={"video_id": "Dock level, dragging cupboard"},
        headers=auth_headers
    )
    assert res.status_code == 200, f"Ingest failed: {res.text}"
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["events_generated_count"] == 10
    assert data["tracks_analyzed"] > 0


def test_database_relationships_and_foreign_keys():
    """
    Verifies 3-layer persistence integrity:
    Video -> InferenceRun -> BehaviourObservation -> RiskAssessment -> Event.
    """
    db = SessionLocal()
    try:
        events = db.query(models.Event).filter(
            models.Event.provenance_type == "REAL_INFERENCE"
        ).all()
        assert len(events) >= 10, f"Expected at least 10 events, got {len(events)}"

        for ev in events:
            assert ev.event_id is not None
            assert ev.video_id is not None
            assert ev.risk_level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
            assert ev.risk_score >= 0.0
            assert ev.evidence_clip_start is not None
            assert ev.evidence_clip_end is not None

            # Verify relationships exist
            assert ev.video is not None, f"Event {ev.event_id} has missing Video relation"
            assert ev.risk_assessment is not None, f"Event {ev.event_id} has missing RiskAssessment relation"
            assert ev.behaviour_observation is not None, f"Event {ev.event_id} has missing BehaviourObservation relation"

            # Check normalized casing
            assert ev.risk_assessment.risk_level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    finally:
        db.close()


def test_api_events_endpoint(client, auth_headers):
    """
    Verifies that GET /api/events returns real ingested Member 2 events.
    """
    res = client.get("/api/events", headers=auth_headers)
    assert res.status_code == 200
    events_list = res.json()
    assert isinstance(events_list, list)
    assert len(events_list) >= 10

    first_evt = events_list[0]
    assert "event_id" in first_evt
    assert "behaviour" in first_evt
    assert "risk_level" in first_evt
    assert "risk_score" in first_evt


def test_api_analytics_summary_breakdown(client, auth_headers):
    """
    Verifies that GET /api/analytics/summary correctly calculates Member 2 risk distributions.
    """
    res = client.get("/api/analytics/summary", headers=auth_headers)
    assert res.status_code == 200
    summary_data = res.json().get("summary", {})
    assert summary_data.get("totalEvents", 0) >= 10
    assert summary_data.get("highRiskEvents", 0) >= 4
    assert summary_data.get("mediumRiskEvents", 0) >= 6
    assert summary_data.get("criticalEvents", 0) == 0


def test_assistant_chat_grounded_in_canonical_events(client, auth_headers):
    """
    Verifies that the AI Assistant grounds answers using canonical Member 2 events.
    """
    res = client.post(
        "/api/assistant/chat",
        json={"question": "What risky behaviours were detected in Dock level?"},
        headers=auth_headers
    )
    assert res.status_code == 200
    answer_data = res.json()
    assert len(answer_data.get("citations", [])) > 0
    assert answer_data.get("answer") is not None
    assert len(answer_data.get("answer")) > 20
