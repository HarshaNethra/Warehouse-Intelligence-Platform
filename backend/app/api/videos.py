from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.video import VideoMetadataResponse
from app.db import repository

router = APIRouter(prefix="/videos", tags=["Videos"])

@router.get("", response_model=List[VideoMetadataResponse])
def list_videos():
    return repository.get_all_videos()

@router.get("/{video_id}", response_model=VideoMetadataResponse)
def get_video(video_id: str):
    video = repository.get_video_by_id(video_id)
    if not video:
        raise HTTPException(status_code=404, detail=f"Video with id '{video_id}' not found")
    return video
