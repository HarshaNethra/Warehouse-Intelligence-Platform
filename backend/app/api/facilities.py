from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

from app.db.database import get_db
from app.db import models
from app.api.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()


class CameraDTO(BaseModel):
    id: str
    loading_bay_id: Optional[str] = None
    name: str
    camera_code: str
    source_type: str
    stream_url: Optional[str] = None
    status: str
    last_seen_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


class LoadingBayDTO(BaseModel):
    id: str
    facility_id: str
    name: str
    code: str
    status: str
    camera_count: int = 0
    active_events_count: int = 0
    latest_incident_behaviour: Optional[str] = None
    risk_level: str = "Low"

    class Config:
        from_attributes = True


class FacilityDTO(BaseModel):
    id: str
    organization_id: Optional[str] = None
    name: str
    location: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    status: str = "ACTIVE"

    class Config:
        from_attributes = True


@router.get("/facilities", response_model=List[FacilityDTO])
def get_facilities(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Facility)
    if current_user.organization_id and current_user.role != "ADMIN":
        query = query.filter(models.Facility.organization_id == current_user.organization_id)
    return query.all()


@router.get("/bays", response_model=List[LoadingBayDTO])
def get_loading_bays(
    facility_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "ADMIN" and current_user.facility_id:
        target_facility_id = current_user.facility_id
    else:
        target_facility_id = facility_id or current_user.facility_id or "FAC-001"
    bays = db.query(models.LoadingBay).filter(models.LoadingBay.facility_id == target_facility_id).all()
    if not bays:
        return []

    bay_ids = [b.id for b in bays]

    from sqlalchemy import func
    cam_counts = dict(
        db.query(models.Camera.loading_bay_id, func.count(models.Camera.id))
        .filter(models.Camera.loading_bay_id.in_(bay_ids))
        .group_by(models.Camera.loading_bay_id)
        .all()
    )

    events = (
        db.query(models.Event)
        .filter(models.Event.facility_id == target_facility_id)
        .order_by(models.Event.timestamp.desc())
        .all()
    )

    events_by_bay = {}
    for e in events:
        key = e.bay_id
        if key not in events_by_bay:
            events_by_bay[key] = []
        events_by_bay[key].append(e)

    result = []
    for bay in bays:
        cam_count = cam_counts.get(bay.id, 0)
        bay_events = events_by_bay.get(bay.id, []) + (events_by_bay.get(bay.name, []) if bay.name != bay.id else [])
        
        active_count = sum(1 for e in bay_events if e.status in ["UNRESOLVED", "OPEN"])
        latest_event = bay_events[0] if bay_events else None
        
        highest_score = max([e.risk_score for e in bay_events], default=0.0)
        risk_level = "Critical" if highest_score >= 85 else "High" if highest_score >= 60 else "Medium" if highest_score >= 35 else "Low"

        result.append(LoadingBayDTO(
            id=bay.id,
            facility_id=bay.facility_id,
            name=bay.name,
            code=bay.code,
            status=bay.status,
            camera_count=cam_count,
            active_events_count=active_count,
            latest_incident_behaviour=latest_event.behaviour if latest_event else None,
            risk_level=risk_level
        ))

    return result


@router.get("/cameras", response_model=List[CameraDTO])
def get_cameras(
    bay_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Camera).join(models.LoadingBay, models.Camera.loading_bay_id == models.LoadingBay.id)
    target_facility_id = current_user.facility_id or "FAC-001"
    if current_user.role != "ADMIN":
        query = query.filter(models.LoadingBay.facility_id == target_facility_id)
    if bay_id:
        query = query.filter(models.Camera.loading_bay_id == bay_id)
        
    cameras = query.all()
    now = datetime.datetime.utcnow()
    
    out = []
    for c in cameras:
        # Dynamic heartbeat evaluation: if last_seen_at > 3 minutes ago, flag as OFFLINE
        status = c.status
        if c.last_seen_at:
            delta_sec = (now - c.last_seen_at).total_seconds()
            if delta_sec > 180 and status != "OFFLINE":
                status = "OFFLINE"

        out.append(CameraDTO(
            id=c.id,
            loading_bay_id=c.loading_bay_id,
            name=c.name,
            camera_code=c.camera_code,
            source_type=c.source_type,
            stream_url=c.stream_url,
            status=status,
            last_seen_at=c.last_seen_at
        ))
        
    return out
