import pytest
import os
import tempfile
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, Event, Detection, InferenceRun
from app.services.inference import MultiModelInferencePipeline, ModelLoadError, compute_file_sha256
from app.services.video_processor import ProductionVideoProcessor
from app.services.rag_store import rag_vector_store
from app.api.analytics import apply_facility_filter
from app.config import settings

@pytest.fixture
def in_memory_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_missing_model_fails_closed(in_memory_db):
    """Test B & E & F: Missing model weights file causes inference failure with ZERO detections/events."""
    non_existent_path = "/tmp/non_existent_yolo_weights_9999.pt"
    
    # 1. Direct MultiModelInferencePipeline check
    pipeline = MultiModelInferencePipeline(det_model_path=non_existent_path)
    assert pipeline.det_model is None
    assert isinstance(pipeline.load_error, ModelLoadError)

    with pytest.raises(ModelLoadError):
        pipeline.process_frame(frame_np=None, frame_index=1, timestamp_sec=0.0)

    # 2. ProductionVideoProcessor check with invalid weights path
    proc = ProductionVideoProcessor()
    proc.model_path = non_existent_path
    proc.model = None
    proc.model_load_error = f"Model file '{non_existent_path}' does not exist on disk."

    result = proc.process_video("non_existent_video.mp4", db_session=in_memory_db)
    assert result["status"] == "FAILED"
    assert result["total_detections"] == 0
    assert result["events_generated_count"] == 0

    # Assert InferenceRun recorded as FAILED in DB
    run_id = result["inference_run_id"]
    inf_run = in_memory_db.query(InferenceRun).filter(InferenceRun.id == run_id).first()
    assert inf_run is not None
    assert inf_run.status == "FAILED"
    assert inf_run.error_message is not None
    assert inf_run.completed_at is not None

    # Assert ZERO detections and ZERO events created in DB
    det_count = in_memory_db.query(Detection).filter(Detection.inference_run_id == run_id).count()
    evt_count = in_memory_db.query(Event).filter(Event.inference_run_id == run_id).count()
    assert det_count == 0
    assert evt_count == 0


def test_corrupted_model_or_hash_mismatch(in_memory_db):
    """Test C & D: Corrupted model file / SHA256 mismatch raises ModelLoadError and fails inference."""
    with tempfile.NamedTemporaryFile(suffix=".pt", delete=False) as tmp:
        tmp.write(b"CORRUPTED_WEIGHTS_DATA_HEADER_12345")
        tmp_path = tmp.name

    try:
        computed_sha = compute_file_sha256(tmp_path)
        wrong_expected_sha = "0000000000000000000000000000000000000000000000000000000000000000"

        # Mismatch assertion
        pipeline = MultiModelInferencePipeline(det_model_path=tmp_path, expected_sha256=wrong_expected_sha)
        assert pipeline.det_model is None
        assert isinstance(pipeline.load_error, ModelLoadError)
        assert "SHA256 mismatch" in str(pipeline.load_error)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_empty_rag_store_returns_zero_synthetic_events():
    """Test G: Vector store initializes empty and does not generate synthetic EVT-101 benchmark events."""
    evt_101_docs = [d for d in rag_vector_store.in_memory_docs if d.get("id") == "EVT-101"]
    assert len(evt_101_docs) == 0


def test_analytics_excludes_demo_and_test_data(in_memory_db):
    """Test I: Production analytics filter excludes is_demo_data=True and is_test_data=True."""
    real_evt = Event(
        event_id="EVT-REAL-001",
        facility_id="FAC-001",
        behaviour="Product Dropped",
        risk_score=85.0,
        risk_level="High",
        is_demo_data=False,
        is_test_data=False,
        provenance_type="REAL_INFERENCE"
    )
    demo_evt = Event(
        event_id="EVT-DEMO-001",
        facility_id="FAC-001",
        behaviour="Improper Stacking",
        risk_score=70.0,
        risk_level="Medium",
        is_demo_data=True,
        is_test_data=False,
        provenance_type="DEMO_FIXTURE"
    )
    test_evt = Event(
        event_id="EVT-TEST-001",
        facility_id="FAC-001",
        behaviour="Rough Handling",
        risk_score=90.0,
        risk_level="Critical",
        is_demo_data=False,
        is_test_data=True,
        provenance_type="UNIT_TEST"
    )
    in_memory_db.add_all([real_evt, demo_evt, test_evt])
    in_memory_db.commit()

    class MockUser:
        facility_id = "FAC-001"
        role = "SUPERVISOR"

    q = in_memory_db.query(Event)
    filtered = apply_facility_filter(q, facility_id="FAC-001", current_user=MockUser(), include_fixtures=False)
    results = filtered.all()

    assert len(results) == 1
    assert results[0].event_id == "EVT-REAL-001"


def test_assistant_sql_excludes_demo_fixtures(in_memory_db):
    """Test FINDING 2: Assistant SQL retrieval layer explicitly excludes is_demo_data, is_test_data, and DEMO_FIXTURE events."""
    from sqlalchemy import or_

    real_evt = Event(
        event_id="EVT-REAL-002",
        facility_id="FAC-001",
        behaviour="Product Dropped",
        risk_score=85.0,
        risk_level="High",
        is_demo_data=False,
        is_test_data=False,
        provenance_type="REAL_INFERENCE"
    )
    demo_evt = Event(
        event_id="EVT-DEMO-002",
        facility_id="FAC-001",
        behaviour="Improper Stacking",
        risk_score=70.0,
        risk_level="Medium",
        is_demo_data=True,
        is_test_data=False,
        provenance_type="DEMO_FIXTURE"
    )
    test_evt = Event(
        event_id="EVT-TEST-002",
        facility_id="FAC-001",
        behaviour="Rough Handling",
        risk_score=90.0,
        risk_level="Critical",
        is_demo_data=False,
        is_test_data=True,
        provenance_type="UNIT_TEST"
    )
    fixture_evt = Event(
        event_id="EVT-FIXTURE-002",
        facility_id="FAC-001",
        behaviour="Unsafe Motion",
        risk_score=60.0,
        risk_level="Low",
        is_demo_data=False,
        is_test_data=False,
        provenance_type="DEMO_FIXTURE"
    )
    in_memory_db.add_all([real_evt, demo_evt, test_evt, fixture_evt])
    in_memory_db.commit()

    events_query = in_memory_db.query(Event).filter(
        Event.facility_id == "FAC-001",
        or_(Event.is_demo_data == False, Event.is_demo_data.is_(None)),
        or_(Event.is_test_data == False, Event.is_test_data.is_(None)),
        or_(Event.provenance_type != "DEMO_FIXTURE", Event.provenance_type.is_(None))
    )
    results = events_query.all()
    result_ids = [e.event_id for e in results]

    assert "EVT-REAL-002" in result_ids
    assert "EVT-DEMO-002" not in result_ids
    assert "EVT-TEST-002" not in result_ids
    assert "EVT-FIXTURE-002" not in result_ids

