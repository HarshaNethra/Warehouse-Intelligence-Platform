import json
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.database import get_db, Base
from app.db import models
from app.api.deps import get_current_user
from app.schemas.provenance import BehaviourObservationDetails
from app.services.inference import MultiModelInferencePipeline, ModelLoadError

from sqlalchemy.pool import StaticPool

# Set up test DB engine
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

models.Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def override_get_current_user():
    return models.User(
        id="USR-TEST-001",
        email="admin@witwatch.com",
        role="ADMIN",
        facility_id="FAC-001"
    )

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)


def test_telemetry_status_when_model_weights_missing():
    """Test 1 & 2 & 5: When model weights are missing, endpoint returns BLOCKED/INSUFFICIENT_DATA and no fake 14.2ms latency."""
    response = client.get("/api/ml/metrics/evaluation")
    assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
    data = response.json()

    # Must contain truthful status
    assert "telemetry_status" in data
    assert data["telemetry_status"] in ["BLOCKED", "INSUFFICIENT_DATA"]

    # In-distribution latency must not be fake 14.2ms
    in_dist = data["in_distribution"]
    assert in_dist["inference_latency_ms"] != 14.2
    assert in_dist["inference_latency_ms"] is None or isinstance(in_dist["inference_latency_ms"], float)
    assert "inference_latency_display" in in_dist

    # OOD metrics must not have fake static latency 16.1ms
    ood = data["out_of_distribution"]
    assert ood["inference_latency_ms"] != 16.1
    assert ood["precision"] is None or ood["status"] == "BLOCKED"


def test_operational_review_telemetry_insufficient_data():
    """Test 13 & 14: When no reviews exist, human review FPR is not reported as 0.0 fake value."""
    response = client.get("/api/ml/metrics/evaluation")
    assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
    data = response.json()

    op_review = data["operational_review_telemetry"]
    assert op_review["status"] == "INSUFFICIENT_DATA"
    assert op_review["human_review_false_positive_rate"] is None


def test_missing_model_weights_fail_closed():
    """Test 5 & 22: Missing model weights fail closed gracefully without hardcoding results."""
    pipeline = MultiModelInferencePipeline(det_model_path="nonexistent_yolo.pt")
    assert pipeline.det_model is None
    assert pipeline.load_error is not None
    assert isinstance(pipeline.load_error, ModelLoadError)

    raised = False
    try:
        pipeline.process_frame(frame_np=None, frame_index=0, timestamp_sec=0.0)
    except ModelLoadError:
        raised = True
    assert raised, "Expected ModelLoadError to be raised"


def test_detector_confidence_remains_separate_from_event_confidence():
    """Test 6: Detector confidence in details_json remains separate from Event.confidence."""
    from app.schemas.provenance import PerceptionProvenance, IdentityProvenance
    details = BehaviourObservationDetails(
        perception=PerceptionProvenance(
            detector_confidence=0.87,
            trigger_bbox=[10.0, 20.0, 100.0, 200.0]
        ),
        identity=IdentityProvenance(track_id=101)
    )
    dumped = details.model_dump()
    assert dumped["perception"]["detector_confidence"] == 0.87
    assert "confidence" not in dumped  # Detector confidence is separate from Event.confidence


def test_facility_scoping_enforced():
    """Test 7: Facility scoping is respected in evaluation metrics."""
    db = TestingSessionLocal()

    # Clear and seed facility specific events
    db.query(models.Event).delete()
    evt1 = models.Event(
        event_id="EVT-FAC1-01",
        facility_id="FAC-001",
        bay_id="BAY-1",
        behaviour="Dropping Package",
        risk_level="HIGH",
        risk_score=80.0,
        confidence=0.92,
        status="UNRESOLVED"
    )
    evt2 = models.Event(
        event_id="EVT-FAC2-01",
        facility_id="FAC-002",
        bay_id="BAY-2",
        behaviour="Dropping Package",
        risk_level="HIGH",
        risk_score=80.0,
        confidence=0.92,
        status="UNRESOLVED"
    )
    db.add_all([evt1, evt2])
    db.commit()
    db.close()

    def override_facility_user():
        return models.User(
            id="USR-FAC1",
            email="user@fac1.com",
            role="OPERATOR",
            facility_id="FAC-001"
        )

    app.dependency_overrides[get_current_user] = override_facility_user
    response = client.get("/api/ml/metrics/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert data["db_events_aggregated"] == 1


if __name__ == "__main__":
    print("Running test_telemetry_status_when_model_weights_missing...")
    test_telemetry_status_when_model_weights_missing()
    print("PASSED")

    print("Running test_operational_review_telemetry_insufficient_data...")
    test_operational_review_telemetry_insufficient_data()
    print("PASSED")

    print("Running test_missing_model_weights_fail_closed...")
    test_missing_model_weights_fail_closed()
    print("PASSED")

    print("Running test_detector_confidence_remains_separate_from_event_confidence...")
    test_detector_confidence_remains_separate_from_event_confidence()
    print("PASSED")

    print("Running test_facility_scoping_enforced...")
    test_facility_scoping_enforced()
    print("PASSED")

    print("\nALL 5 TELEMETRY TESTS PASSED SUCCESSFULLY!")

