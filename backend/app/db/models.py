import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Index
from sqlalchemy.orm import relationship
from app.db.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    facilities = relationship("Facility", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    timezone = Column(String, default="Asia/Kolkata")
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="facilities")
    users = relationship("User", back_populates="facility")
    events = relationship("Event", back_populates="facility")
    loading_bays = relationship("LoadingBay", back_populates="facility", cascade="all, delete-orphan")
    safety_rules = relationship("SafetyRule", back_populates="facility", cascade="all, delete-orphan")
    shifts = relationship("Shift", back_populates="facility", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="OPERATOR", nullable=False)  # ADMIN, SUPERVISOR, OPERATOR, QUALITY, SAFETY, VIEWER
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="users")
    facility = relationship("Facility", back_populates="users")
    acknowledged_events = relationship("Event", back_populates="acknowledged_by", foreign_keys="Event.acknowledged_by_user_id")


class LoadingBay(Base):
    __tablename__ = "loading_bays"

    id = Column(String, primary_key=True, index=True)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    status = Column(String, default="Operational")  # Operational, Monitoring, Maintenance
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    facility = relationship("Facility", back_populates="loading_bays")
    cameras = relationship("Camera", back_populates="loading_bay", cascade="all, delete-orphan")


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String, primary_key=True, index=True)
    loading_bay_id = Column(String, ForeignKey("loading_bays.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    camera_code = Column(String, nullable=False)
    source_type = Column(String, default="LIVE_STREAM")  # LIVE_STREAM, VIDEO_FILE, SMARTPHONE, CCTV
    stream_url = Column(String, nullable=True)
    status = Column(String, default="ONLINE")  # ONLINE, DEGRADED, OFFLINE, PROCESSING, UNKNOWN
    last_seen_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    loading_bay = relationship("LoadingBay", back_populates="cameras")


class Video(Base):
    __tablename__ = "videos"

    video_id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.id"), nullable=True, index=True)
    uploaded_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=True)
    storage_key = Column(String, nullable=True)
    mime_type = Column(String, default="video/mp4")
    frame_count = Column(Integer, default=0)
    fps = Column(Float, default=30.0)
    width = Column(Integer, default=1920)
    height = Column(Integer, default=1080)
    duration = Column(Float, default=0.0)
    status = Column(String, default="processed")  # UPLOADED, QUEUED, PROCESSING, COMPLETED, FAILED
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    events = relationship("Event", back_populates="video")
    telemetry_points = relationship("TelemetryPoint", back_populates="video")
    processing_jobs = relationship("VideoProcessingJob", back_populates="video", cascade="all, delete-orphan")


class VideoProcessingJob(Base):
    __tablename__ = "video_processing_jobs"

    id = Column(String, primary_key=True, index=True)
    video_id = Column(String, ForeignKey("videos.video_id"), nullable=False, index=True)
    job_type = Column(String, default="FULL_PIPELINE")  # OBJECT_DETECTION, OBJECT_TRACKING, BEHAVIOUR_ANALYSIS, RISK_ANALYSIS, FULL_PIPELINE
    status = Column(String, default="QUEUED")  # QUEUED, PROCESSING, COMPLETED, FAILED
    model_version = Column(String, default="YOLO11s-v1.0")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    video = relationship("Video", back_populates="processing_jobs")


class FrameRecord(Base):
    __tablename__ = "frame_records"

    id = Column(String, primary_key=True, index=True)
    inference_run_id = Column(String, ForeignKey("inference_runs.id"), nullable=False, index=True)
    video_id = Column(String, ForeignKey("videos.video_id"), nullable=False, index=True)
    frame_number = Column(Integer, nullable=False, index=True)
    timestamp_ms = Column(Float, nullable=False, index=True)
    width = Column(Integer, default=1920)
    height = Column(Integer, default=1080)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    inference_run_id = Column(String, ForeignKey("inference_runs.id"), nullable=True, index=True)
    frame_id = Column(String, ForeignKey("frame_records.id"), nullable=True, index=True)
    video_id = Column(String, ForeignKey("videos.video_id"), nullable=False, index=True)
    camera_id = Column(String, nullable=True)
    timestamp_ms = Column(Float, nullable=False, index=True)
    frame_number = Column(Integer, nullable=True)
    object_type = Column(String, nullable=False, index=True)  # PERSON, PRODUCT, PALLET, TROLLEY, FORKLIFT, VEHICLE
    track_id = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=False)
    bbox_x = Column(Float, nullable=False)
    bbox_y = Column(Float, nullable=False)
    bbox_width = Column(Float, nullable=False)
    bbox_height = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ObjectTrack(Base):
    __tablename__ = "object_tracks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    inference_run_id = Column(String, ForeignKey("inference_runs.id"), nullable=True, index=True)
    video_id = Column(String, ForeignKey("videos.video_id"), nullable=False, index=True)
    track_id = Column(Integer, nullable=False, index=True)
    object_type = Column(String, nullable=False)
    start_timestamp_ms = Column(Float, nullable=False)
    end_timestamp_ms = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class BehaviourObservation(Base):
    __tablename__ = "behaviour_observations"

    id = Column(String, primary_key=True, index=True)
    inference_run_id = Column(String, ForeignKey("inference_runs.id"), nullable=False, index=True)
    video_id = Column(String, ForeignKey("videos.video_id"), nullable=False, index=True)
    track_id = Column(Integer, nullable=True, index=True)
    frame_number = Column(Integer, nullable=False, index=True)
    timestamp = Column(Float, nullable=False, index=True)
    behaviour_type = Column(String, nullable=False, index=True)
    confidence = Column(Float, nullable=False, default=0.90)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_facility_timestamp", "facility_id", "timestamp"),
        Index("ix_events_status_facility", "status", "facility_id"),
        Index("ix_events_provenance_type", "provenance_type"),
    )

    event_id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True, index=True)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=True, index=True)
    video_id = Column(String, ForeignKey("videos.video_id"), nullable=True)
    timestamp = Column(Float, index=True)
    camera_id = Column(String, nullable=True)
    bay_id = Column(String, nullable=True)
    object_id = Column(Integer, nullable=True)
    behaviour = Column(String, index=True)
    risk_score = Column(Float)
    risk_level = Column(String, index=True)
    description = Column(Text)
    reason = Column(Text)
    evidence_frame = Column(String, nullable=True)
    video_reference = Column(String, nullable=True)
    recommended_action = Column(Text, nullable=True)
    status = Column(String, default="UNRESOLVED", index=True)  # UNRESOLVED, ACKNOWLEDGED, DISPATCHED, UNDER_REVIEW, CONFIRMED_RISK, FALSE_POSITIVE, RESOLVED
    acknowledged_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    model_name = Column(String, default="YOLO11s")
    model_version = Column(String, default="v1.4.2-tensorrt")
    inference_engine = Column(String, default="LOCAL_YOLO11")
    confidence = Column(Float, default=0.92)
    provenance_type = Column(String, default="DEVELOPMENT_SEED", index=True)  # REAL_INFERENCE, DEVELOPMENT_SEED, DEMO_FIXTURE, PERFORMANCE_TEST, UNIT_TEST
    environment = Column(String, default="DEVELOPMENT", index=True)  # DEVELOPMENT, TEST, DEMO, STAGING, PRODUCTION
    is_test_data = Column(Boolean, default=False, index=True)
    is_demo_data = Column(Boolean, default=False, index=True)
    inference_run_id = Column(String, ForeignKey("inference_runs.id"), nullable=True, index=True)
    risk_assessment_id = Column(String, ForeignKey("risk_assessments.id"), nullable=True, index=True)
    behaviour_observation_id = Column(String, ForeignKey("behaviour_observations.id"), nullable=True, index=True)
    frame_number = Column(Integer, nullable=True)
    video_fps = Column(Float, nullable=True, default=30.0)
    timestamp_seconds = Column(Float, nullable=True)
    timestamp_utc = Column(DateTime, nullable=True)
    evidence_clip_start = Column(Float, nullable=True)
    evidence_clip_end = Column(Float, nullable=True)
    processing_latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    video = relationship("Video", back_populates="events")
    facility = relationship("Facility", back_populates="events")
    acknowledged_by = relationship("User", back_populates="acknowledged_events", foreign_keys=[acknowledged_by_user_id])
    risk_assessments = relationship("RiskAssessment", back_populates="event", cascade="all, delete-orphan", foreign_keys="[RiskAssessment.event_id]")
    risk_assessment = relationship("RiskAssessment", foreign_keys=[risk_assessment_id])
    behaviour_observation = relationship("BehaviourObservation", foreign_keys=[behaviour_observation_id])
    reviews = relationship("IncidentReview", back_populates="event", cascade="all, delete-orphan")
    inference_run = relationship("InferenceRun", back_populates="events")


class InferenceRun(Base):
    __tablename__ = "inference_runs"

    id = Column(String, primary_key=True, index=True)
    video_id = Column(String, ForeignKey("videos.video_id"), nullable=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.id"), nullable=True, index=True)
    model_name = Column(String, nullable=False, default="YOLO11s")
    model_version = Column(String, nullable=False, default="v1.4.2-tensorrt")
    inference_engine = Column(String, nullable=False, default="LOCAL_YOLO11")
    device = Column(String, default="cpu")
    status = Column(String, default="COMPLETED")
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    provenance_type = Column(String, default="REAL_INFERENCE", index=True)

    events = relationship("Event", back_populates="inference_run")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.event_id"), nullable=False, index=True)
    behaviour_observation_id = Column(String, ForeignKey("behaviour_observations.id"), nullable=True, index=True)
    risk_level = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False, default=0.92)
    reason = Column(Text, nullable=True)
    risk_factors_json = Column(Text, nullable=True)
    model_version = Column(String, default="warehouse-risk-v1.4")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event", back_populates="risk_assessments", foreign_keys=[event_id])


class IncidentReview(Base):
    __tablename__ = "incident_reviews"

    id = Column(String, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.event_id"), nullable=False, index=True)
    reviewer_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    decision = Column(String, nullable=False)  # CONFIRMED, FALSE_POSITIVE, NEEDS_REVIEW
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event", back_populates="reviews")


class SafetyRule(Base):
    __tablename__ = "safety_rules"

    id = Column(String, primary_key=True, index=True)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    behaviour_type = Column(String, nullable=False, index=True)
    threshold_config_json = Column(Text, nullable=True)
    risk_level = Column(String, nullable=False, default="High")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    facility = relationship("Facility", back_populates="safety_rules")


class ModelRun(Base):
    __tablename__ = "model_runs"

    id = Column(String, primary_key=True, index=True)
    model_name = Column(String, nullable=False)
    model_version = Column(String, nullable=False)
    device = Column(String, default="cuda")
    fps = Column(Float, default=89.4)
    latency_ms = Column(Float, default=11.2)
    confidence_threshold = Column(Float, default=0.45)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="RUNNING")  # RUNNING, COMPLETED, FAILED


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(String, primary_key=True, index=True)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    start_time = Column(String, nullable=False)  # "06:00"
    end_time = Column(String, nullable=False)    # "14:00"
    timezone = Column(String, default="Asia/Kolkata")
    active = Column(Boolean, default=True)

    facility = relationship("Facility", back_populates="shifts")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, nullable=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class TelemetryPoint(Base):
    __tablename__ = "telemetry_points"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(String, ForeignKey("videos.video_id"), index=True)
    session_id = Column(String, index=True, nullable=True)
    timestamp = Column(Float, index=True)
    risk_score = Column(Float)
    status = Column(String)
    violations_json = Column(Text, nullable=True)
    boxes_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    video = relationship("Video", back_populates="telemetry_points")


class EvaluationDataset(Base):
    __tablename__ = "evaluation_datasets"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    version = Column(String, nullable=False)
    behaviour_class = Column(String, nullable=True)
    sample_count = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    samples = relationship("EvaluationSample", back_populates="dataset", cascade="all, delete-orphan")


class EvaluationSample(Base):
    __tablename__ = "evaluation_samples"

    id = Column(String, primary_key=True, index=True)
    dataset_id = Column(String, ForeignKey("evaluation_datasets.id"), nullable=False, index=True)
    video_id = Column(String, nullable=True)
    frame_number = Column(Integer, nullable=True)
    timestamp = Column(Float, nullable=True)
    ground_truth_label = Column(String, nullable=False)
    predicted_label = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    dataset = relationship("EvaluationDataset", back_populates="samples")
