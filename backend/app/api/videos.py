import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db import models
from app.schemas import event as event_schema

router = APIRouter()

backend_dir = Path(__file__).resolve().parent.parent.parent

@router.get("/videos", response_model=List[event_schema.VideoMetadata])
def get_videos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    videos = db.query(models.Video).offset(skip).limit(limit).all()
    return videos

@router.get("/videos/{video_id}/frames/{frame_number}")
def get_video_frame(video_id: str, frame_number: int, db: Session = Depends(get_db)):
    try:
        import cv2
    except ImportError:
        raise HTTPException(
            status_code=503, 
            detail="OpenCV (cv2) is not installed on the server. Install opencv-python or use Roboflow hosted inference."
        )
    import urllib.parse
    from fastapi.responses import Response

    decoded_id = urllib.parse.unquote(video_id)
    
    # Try finding Video record in DB to get exact filename
    video_record = db.query(models.Video).filter(models.Video.video_id == decoded_id).first()
    search_names = []
    if video_record and video_record.filename:
        search_names.append(video_record.filename)
    search_names.extend([
        decoded_id,
        f"{decoded_id}.mp4",
        "Rolling and dropping carton.mp4",
        "example.mp4"
    ])

    video_path = None
    for name in search_names:
        possible_paths = [
            backend_dir / "storage" / "videos" / name,
            backend_dir.parent / "Godrej" / "videos" / name,
            backend_dir.parent / "frontend" / "public" / "videos" / name,
            backend_dir.parent.parent / "Godrej" / "videos" / name,
            Path(name)
        ]
        for p in possible_paths:
            if p.exists() and p.is_file():
                video_path = p
                break
        if video_path:
            break

    if not video_path:
        raise HTTPException(status_code=404, detail=f"Video resource for '{video_id}' not found")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Failed to open video file")

    try:
        target_frame = max(0, frame_number - 1)
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ret, frame = cap.read()
        if not ret or frame is None:
            raise HTTPException(status_code=404, detail=f"Frame {frame_number} not found in video '{video_id}'")

        success, encoded_img = cv2.imencode(".jpg", frame)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to encode frame image")

        return Response(content=encoded_img.tobytes(), media_type="image/jpeg")
    finally:
        cap.release()

@router.get("/videos/{video_id}/telemetry")
def get_video_telemetry(video_id: str) -> Dict[str, Any]:
    raw_path = backend_dir / "test_outputs" / "detections_raw.json"
    detections = []
    if raw_path.exists():
        try:
            with open(raw_path, mode="r", encoding="utf-8") as f:
                detections = json.load(f)
        except Exception:
            detections = []
            
    return {
        "video_id": video_id,
        "status": "success",
        "detector": "YOLO11s",
        "tracker": "ByteTrack",
        "detections_count": len(detections),
        "telemetry": detections
    }

@router.get("/stream/video/{file_name:path}")
@router.get("/videos/stream/{file_name:path}")
async def stream_video(file_name: str, range: str = Header(None)):
    import os
    import urllib.parse
    from fastapi.responses import StreamingResponse

    decoded_name = urllib.parse.unquote(file_name)

    possible_paths = [
        backend_dir / "storage" / "videos" / decoded_name,
        backend_dir.parent / "Godrej" / "videos" / decoded_name,
        backend_dir.parent / "frontend" / "public" / "videos" / decoded_name,
        backend_dir.parent.parent / "Godrej" / "videos" / decoded_name,
    ]

    video_path = None
    for p in possible_paths:
        if p.exists() and p.is_file():
            video_path = p
            break

    if not video_path:
        raise HTTPException(status_code=404, detail=f"Video file '{decoded_name}' not found on storage node")

    file_size = os.path.getsize(video_path)
    start = 0
    end = file_size - 1

    if range:
        try:
            range_str = range.replace("bytes=", "")
            parts = range_str.split("-")
            start = int(parts[0])
            if parts[1]:
                end = int(parts[1])
        except ValueError:
            pass

    chunk_size = (end - start) + 1

    def iterfile():
        with open(video_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                bytes_to_read = min(remaining, 1024 * 1024)
                data = f.read(bytes_to_read)
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
    }
    return StreamingResponse(iterfile(), status_code=206, headers=headers)


class VideoProcessPayload(BaseModel if 'BaseModel' in globals() else object):
    pass

from pydantic import BaseModel

class VideoProcessRequest(BaseModel):
    facility_id: Optional[str] = "FAC-001"
    camera_id: Optional[str] = "CAM-01"
    max_frames: Optional[int] = None


@router.post("/videos/{video_id}/process")
@router.post("/videos/process")
def process_video_endpoint(
    video_id: str = "vid-cam01-20231027",
    payload: Optional[VideoProcessRequest] = None,
    db: Session = Depends(get_db)
):
    from app.services.video_processor import ProductionVideoProcessor
    
    facility_id = payload.facility_id if payload else "FAC-001"
    camera_id = payload.camera_id if payload else "CAM-01"
    max_frames = payload.max_frames if payload else None

    processor = ProductionVideoProcessor()
    try:
        summary = processor.process_video(
            video_source=video_id,
            facility_id=facility_id,
            camera_id=camera_id,
            db_session=db,
            max_frames=max_frames
        )
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video processing failed: {str(e)}")

