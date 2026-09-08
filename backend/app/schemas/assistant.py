from typing import List, Optional
from pydantic import BaseModel

class SourceEvent(BaseModel):
    event_id: str
    behaviour: str
    risk_level: str
    risk_score: float
    timestamp: float
    bay_id: Optional[str] = None
    description: Optional[str] = None

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = "default"
    camera_id: Optional[str] = None
    bay_id: Optional[str] = None

class ChatResponse(BaseModel):
    question: str
    answer: str
    source_events: List[SourceEvent] = []
    model_used: str = "grounded-rag"
