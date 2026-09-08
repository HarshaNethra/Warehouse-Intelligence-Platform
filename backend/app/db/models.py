from dataclasses import dataclass
from typing import Optional, List

@dataclass
class VideoRecord:
    video_id: str
    filename: Optional[str] = None
    fps: float = 30.0
    frame_count: int = 0
    width: int = 1920
    height: int = 1080
    duration: float = 0.0
    status: str = "processed"
    created_at: Optional[str] = None

@dataclass
class EventRecord:
    event_id: str
    video_id: str
    timestamp: float
    behaviour: str
    risk_score: float
    risk_level: str
    camera_id: Optional[str] = None
    bay_id: Optional[str] = None
    object_id: Optional[int] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    tags: Optional[List[str]] = None
    evidence_frame: Optional[str] = None
    video_reference: Optional[str] = None
    recommended_action: Optional[str] = None
    created_at: Optional[str] = None
