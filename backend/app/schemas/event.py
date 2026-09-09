from pydantic import BaseModel
from typing import Optional, List, Union
from datetime import datetime

class VideoMetadataBase(BaseModel):
    video_id: str
    filename: Optional[str] = None
    frame_count: int
    fps: float
    width: int
    height: int
    duration: float
    status: Optional[str] = None

class VideoMetadataCreate(VideoMetadataBase):
    pass

class VideoMetadata(VideoMetadataBase):
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EventBase(BaseModel):
    event_id: str
    facility_id: Optional[str] = None
    video_id: Optional[str] = None
    timestamp: float
    camera_id: Optional[str] = None
    bay_id: Optional[str] = None
    object_id: Optional[int] = None
    behaviour: str
    risk_score: float
    risk_level: str
    description: str
    reason: str
    potential_consequence: Optional[str] = None
    risk_factors_json: Optional[str] = None
    evidence_frame: Optional[str] = None
    video_reference: Optional[str] = None
    recommended_action: Optional[str] = None
    status: Optional[str] = "UNRESOLVED"
    acknowledged_by_user_id: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    inference_engine: Optional[str] = None
    confidence: Optional[float] = None
    rule_version: Optional[str] = None
    provenance_type: Optional[str] = "DEVELOPMENT_SEED"
    inference_run_id: Optional[str] = None
    frame_number: Optional[int] = None
    video_fps: Optional[float] = None
    timestamp_seconds: Optional[float] = None
    timestamp_utc: Optional[Union[datetime, str]] = None
    evidence_clip_start: Optional[float] = None
    evidence_clip_end: Optional[float] = None
    processing_latency_ms: Optional[float] = None

class EventCreate(EventBase):
    pass

class Event(EventBase):
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InferenceRunBase(BaseModel):
    video_id: Optional[str] = None
    camera_id: Optional[str] = None
    model_name: str = "YOLO11s"
    model_version: str = "v1.4.2-tensorrt"
    inference_engine: str = "LOCAL_YOLO11"
    device: Optional[str] = "cpu"
    status: Optional[str] = "COMPLETED"
    provenance_type: Optional[str] = "REAL_INFERENCE"

class InferenceRunCreate(InferenceRunBase):
    id: str

class InferenceRun(InferenceRunBase):
    id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
