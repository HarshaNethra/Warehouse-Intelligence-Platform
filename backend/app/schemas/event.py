from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class EventBase(BaseModel):
    event_id: str
    video_id: str
    timestamp: float
    camera_id: Optional[str] = None
    bay_id: Optional[str] = None
    object_id: Optional[int] = None
    behaviour: str
    risk_score: float
    risk_level: RiskLevel
    description: Optional[str] = ""
    reason: Optional[str] = ""
    tags: Optional[List[str]] = Field(default_factory=list)
    evidence_frame: Optional[str] = None
    video_reference: Optional[str] = None
    recommended_action: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class EventFilterParams(BaseModel):
    risk_level: Optional[str] = None
    behaviour: Optional[str] = None
    bay_id: Optional[str] = None
    camera_id: Optional[str] = None
    search: Optional[str] = None
    limit: int = 100
    skip: int = 0
