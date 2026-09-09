import pytest
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, Event, Detection, InferenceRun
from app.services.video_processor import ProductionVideoProcessor
from app.services.inference import compute_file_sha256

@pytest.fixture
def real_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_real_inference_integration_provenance(real_db):
    """
    Test A & J & K (Integration Verification):
    Executes actual warehouse video through the actual YOLO model (best.pt).
    Verifies real Detection persistence and InferenceRun provenance without synthetic boxes.
    """
    proc = ProductionVideoProcessor()
    
    assert proc.model is not None, "Real YOLO model weights (best.pt) must be loaded for real integration test."
    assert proc.model_path is not None
    assert proc.model_sha256 is not None

    # Compute expected SHA256 of best.pt directly from disk
    actual_file_sha = compute_file_sha256(proc.model_path)
    assert proc.model_sha256 == actual_file_sha
    assert actual_file_sha == "06ac28cd857c2ac008981bf159082fad4af55ee2ba1924c80746161de3af97b8"

    # Process first 30 frames of real warehouse video clip
    video_filename = "Rolling and dropping carton.mp4"
    summary = proc.process_video(
        video_source=video_filename,
        facility_id="FAC-001",
        camera_id="CAM-01",
        db_session=real_db,
        max_frames=30
    )

    # 1. Assert overall pipeline status is SUCCESS
    assert summary["status"] == "SUCCESS"
    assert summary["frames_processed"] == 30
    assert summary["total_detections"] > 0

    run_id = summary["inference_run_id"]

    # 2. Query InferenceRun from database
    inf_run = real_db.query(InferenceRun).filter(InferenceRun.id == run_id).first()
    assert inf_run is not None
    assert inf_run.status == "SUCCESS"
    assert inf_run.model_sha256 == actual_file_sha
    assert inf_run.model_path == proc.model_path
    assert inf_run.started_at is not None
    assert inf_run.completed_at is not None

    # 3. Query Detection records from database (Test J)
    db_detections = real_db.query(Detection).filter(Detection.inference_run_id == run_id).all()
    assert len(db_detections) > 0

    for det in db_detections:
        assert det.inference_run_id == run_id
        assert det.inference_run_id is not None
        assert det.object_type in ["PERSON", "CARTON", "PALLET", "FORKLIFT", "PALLET_JACK", "TROLLEY", "MATTRESS", "TRUCK", "DOCK_GAP", "STRAP"]

    # 4. Query Event records from database (Test K)
    db_events = real_db.query(Event).filter(Event.inference_run_id == run_id).all()
    for evt in db_events:
        assert evt.inference_run_id == run_id
        assert evt.inference_run_id is not None
        assert evt.is_demo_data is False
        assert evt.is_test_data is False
