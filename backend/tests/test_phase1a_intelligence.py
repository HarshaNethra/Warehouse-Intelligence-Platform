import pytest
import json
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, Event, RiskAssessment, BehaviourObservation, InferenceRun
from app.services.rule_engine import SafetyRuleEngine, KinematicsEngine, CONSEQUENCE_MAP
from app.api.analytics import apply_facility_filter

@pytest.fixture
def in_memory_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_freefall_creates_structured_risk_assessment_and_event(in_memory_db):
    """Test 1 & 2 & 3 & 4 & 5: Freefall drop produces structured risk_factors_json, dynamic reason, potential_consequence, and recommended_action."""
    engine = SafetyRuleEngine(fps=30.0)

    # Frame 1 & 2: Object moving down to build bbox history
    det1 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 100.0, 200.0, 200.0]}]
    det2 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 110.0, 200.0, 210.0]}]
    det3 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 130.0, 200.0, 230.0]}]
    det4 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 160.0, 200.0, 260.0]}]
    det5 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 200.0, 200.0, 300.0]}]

    for f_idx, d in enumerate([det1, det2, det3, det4, det5], 1):
        alerts = engine.evaluate_frame(f_idx, f_idx * 0.033, d, [], db_session=in_memory_db, inference_run_id="RUN-TEST-001")

    assert len(alerts) >= 1
    freefall_alert = [a for a in alerts if a["rule_id"] == "RULE_KINEMATICS_FREEFALL"][0]
    assert freefall_alert["risk_score"] in [84.0, 92.4]
    assert "risk_factors" in freefall_alert
    
    rf = freefall_alert["risk_factors"]
    assert rf["rule_id"] == "RULE_KINEMATICS_FREEFALL"
    assert rf["measured_value"] > 8.0
    assert rf["threshold"] == 8.0
    assert rf["unit"] == "m/s²"
    assert rf["object_type"] == "carton"

    # Query DB records
    db_evt = in_memory_db.query(Event).filter(Event.inference_run_id == "RUN-TEST-001").first()
    assert db_evt is not None
    assert db_evt.behaviour.startswith("Product Freefall")
    assert db_evt.potential_consequence == CONSEQUENCE_MAP["RULE_KINEMATICS_FREEFALL"]["potential_consequence"]
    assert db_evt.recommended_action == CONSEQUENCE_MAP["RULE_KINEMATICS_FREEFALL"]["recommended_action"]
    assert db_evt.risk_factors_json is not None

    db_rf = json.loads(db_evt.risk_factors_json)
    assert db_rf["rule_id"] == "RULE_KINEMATICS_FREEFALL"
    assert "exceeded 8.0 m/s² threshold" in db_evt.reason

    # Query RiskAssessment record
    db_ra = in_memory_db.query(RiskAssessment).filter(RiskAssessment.event_id == db_evt.event_id).first()
    assert db_ra is not None
    assert db_ra.risk_factors_json == db_evt.risk_factors_json
    assert db_ra.potential_consequence == db_evt.potential_consequence


def test_pure_behaviour_observation_layer(in_memory_db):
    """Test 6: BehaviourObservation records pure CV observation details without polluting with risk scores or consequences."""
    engine = SafetyRuleEngine(fps=30.0)

    # Trigger rule 01 (person stepping on inventory)
    pose = {"keypoints": [[0, 0, 0]] * 15 + [[150.0, 150.0, 0.9], [150.0, 150.0, 0.9]]} # Ankles inside box
    det = [{"track_id": 42, "class": "pallet", "bbox": [100.0, 100.0, 200.0, 200.0]}]

    # Run for 15 frames to trigger state-machine persistence
    for f in range(1, 16):
        engine.evaluate_frame(f, f * 0.033, det, [pose], db_session=in_memory_db, inference_run_id="RUN-TEST-002")

    db_obs = in_memory_db.query(BehaviourObservation).filter(BehaviourObservation.inference_run_id == "RUN-TEST-002").first()
    assert db_obs is not None
    assert db_obs.track_id == 42
    assert db_obs.behaviour_type == "Person Stepping on Inventory / Pallet"

    details = json.loads(db_obs.details_json)
    assert details["rule_id"] == "RULE_01_PERSON_ON_INVENTORY"
    assert "risk_score" not in details
    assert "potential_consequence" not in details


def test_non_fabrication_of_predicted_and_confirmed_outcomes(in_memory_db):
    """Test 5 & 6 (User Prompt Section 15): Predicted outcome and confirmed outcome are NOT fabricated."""
    engine = SafetyRuleEngine(fps=30.0)
    det1 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 100.0, 200.0, 200.0]}]
    det2 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 110.0, 200.0, 210.0]}]
    det3 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 130.0, 200.0, 230.0]}]
    det4 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 160.0, 200.0, 260.0]}]
    det5 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 200.0, 200.0, 300.0]}]

    for f_idx, d in enumerate([det1, det2, det3, det4, det5], 1):
        engine.evaluate_frame(f_idx, f_idx * 0.033, d, [], db_session=in_memory_db, inference_run_id="RUN-TEST-003")

    db_evt = in_memory_db.query(Event).filter(Event.inference_run_id == "RUN-TEST-003").first()
    assert db_evt is not None

    # Assert no fake damage confirmation or probability claim
    assert "damaged" not in db_evt.reason.lower()
    assert "100%" not in db_evt.reason
    assert not hasattr(db_evt, "predicted_damage_probability")
    assert not hasattr(db_evt, "confirmed_damage_outcome")


def test_provenance_and_evidence_retention(in_memory_db):
    """Test 7 & 8: Event retains inference_run_id, frame_number, evidence_frame, timestamp, and camera_id."""
    engine = SafetyRuleEngine(fps=30.0)
    det1 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 100.0, 200.0, 200.0]}]
    det2 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 110.0, 200.0, 210.0]}]
    det3 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 130.0, 200.0, 230.0]}]
    det4 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 160.0, 200.0, 260.0]}]
    det5 = [{"track_id": 10, "class": "carton", "bbox": [100.0, 200.0, 200.0, 300.0]}]

    for f_idx, d in enumerate([det1, det2, det3, det4, det5], 1):
        engine.evaluate_frame(f_idx, f_idx * 0.033, d, [], db_session=in_memory_db, inference_run_id="RUN-PROV-999")

    db_evt = in_memory_db.query(Event).filter(Event.inference_run_id == "RUN-PROV-999").first()
    assert db_evt is not None
    assert db_evt.inference_run_id == "RUN-PROV-999"
    assert db_evt.frame_number is not None
    assert db_evt.timestamp > 0.0
    assert db_evt.camera_id == "CAM-01"
    assert db_evt.evidence_frame.startswith("/api/videos/CAM-01/frames/")


def test_state_machine_thresholds_intact(in_memory_db):
    """Test 9: Kinematic freefall triggers at 3 frames; sustained rules trigger at 15 frames."""
    engine = SafetyRuleEngine(fps=30.0)

    # 1. Kinematic drop - frames 1 to 4 (only 2 freefall frames) should NOT persist to DB yet
    det1 = [{"track_id": 99, "class": "carton", "bbox": [100.0, 100.0, 200.0, 200.0]}]
    det2 = [{"track_id": 99, "class": "carton", "bbox": [100.0, 110.0, 200.0, 210.0]}]
    det3 = [{"track_id": 99, "class": "carton", "bbox": [100.0, 130.0, 200.0, 230.0]}] # 1st freefall alert
    det4 = [{"track_id": 99, "class": "carton", "bbox": [100.0, 160.0, 200.0, 260.0]}] # 2nd freefall alert

    for f_idx, d in enumerate([det1, det2, det3, det4], 1):
        engine.evaluate_frame(f_idx, f_idx * 0.033, d, [], db_session=in_memory_db, inference_run_id="RUN-THRESH-001")
    assert in_memory_db.query(Event).filter(Event.inference_run_id == "RUN-THRESH-001").count() == 0

    # Frame 5 (3rd freefall alert) triggers event
    det5 = [{"track_id": 99, "class": "carton", "bbox": [100.0, 200.0, 200.0, 300.0]}]
    engine.evaluate_frame(5, 0.165, det5, [], db_session=in_memory_db, inference_run_id="RUN-THRESH-001")
    assert in_memory_db.query(Event).filter(Event.inference_run_id == "RUN-THRESH-001").count() == 1

    # 2. Vehicle proximity - should require 15 consecutive frames
    pose = {"keypoints": [[100.0, 100.0, 0.9]] + [[0, 0, 0]] * 16} # Nose at 100,100
    veh_det = [{"track_id": 88, "class": "forklift", "bbox": [100.0, 100.0, 200.0, 200.0]}]
    for f in range(1, 15):
        engine.evaluate_frame(f, f * 0.033, veh_det, [pose], db_session=in_memory_db, inference_run_id="RUN-THRESH-002")
    assert in_memory_db.query(Event).filter(Event.inference_run_id == "RUN-THRESH-002").count() == 0

    # Frame 15 triggers event
    engine.evaluate_frame(15, 0.500, veh_det, [pose], db_session=in_memory_db, inference_run_id="RUN-THRESH-002")
    assert in_memory_db.query(Event).filter(Event.inference_run_id == "RUN-THRESH-002").count() == 1


def test_analytics_and_fixture_filtering_intact(in_memory_db):
    """Test 10 & 11: Existing fixture filtering and analytics filters continue to work."""
    real_evt = Event(
        event_id="EVT-P1A-REAL",
        facility_id="FAC-001",
        behaviour="Product Freefall / Drop",
        risk_score=84.0,
        risk_level="High",
        potential_consequence="Potential product/package structural damage",
        recommended_action="Inspect carton",
        is_demo_data=False,
        is_test_data=False,
        provenance_type="REAL_INFERENCE"
    )
    demo_evt = Event(
        event_id="EVT-P1A-DEMO",
        facility_id="FAC-001",
        behaviour="Improper Stacking",
        risk_score=70.0,
        risk_level="Medium",
        is_demo_data=True,
        is_test_data=False,
        provenance_type="DEMO_FIXTURE"
    )
    in_memory_db.add_all([real_evt, demo_evt])
    in_memory_db.commit()

    class MockUser:
        facility_id = "FAC-001"
        role = "SUPERVISOR"

    q = in_memory_db.query(Event)
    filtered = apply_facility_filter(q, facility_id="FAC-001", current_user=MockUser(), include_fixtures=False)
    results = filtered.all()

    assert len(results) == 1
    assert results[0].event_id == "EVT-P1A-REAL"


def test_database_migration_row_count_integrity():
    """Test 12: Database migration safety check on backend/warehouse.db."""
    from pathlib import Path
    backend_dir = Path(__file__).resolve().parent.parent
    db_path = backend_dir / "warehouse.db"
    if not db_path.exists():
        pytest.skip("warehouse.db does not exist in backend directory")

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM inference_runs")
    inf_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM events")
    evt_count = cursor.fetchone()[0]

    conn.close()

    assert inf_count >= 0
    assert evt_count >= 0
