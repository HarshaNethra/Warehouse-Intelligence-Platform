from typing import Optional
from pydantic import BaseModel

class VideoMetadataResponse(BaseModel):
    video_id: str
    filename: Optional[str] = None
    fps: float
    frame_count: int
    width: int
    height: int
    duration: float
    status: Optional[str] = "processed"
    created_at: Optional[str] = None

    class Config:
        from_attributes = True
