from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class Citation(BaseModel):
    event_id: str
    timestamp: float
    facility_id: str
    bay_id: Optional[str] = None
    camera_id: Optional[str] = None
    behaviour: str
    description: str
    source_document: str = "SQL_EVENT_DB"

class DataScope(BaseModel):
    user_id: str
    user_role: str
    authorized_facility_id: str
    requested_facility_id: Optional[str] = None

class ChatRequest(BaseModel):
    question: str
    facility_id: Optional[str] = None
    session_id: Optional[str] = None
    camera_id: Optional[str] = None
    bay_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
    data_scope: DataScope
    generated_at: str
    model: str
    retrieval_count: int
    # Backward compatibility aliases
    question: Optional[str] = None
    source_events: Optional[List[Citation]] = None
    model_used: Optional[str] = None
