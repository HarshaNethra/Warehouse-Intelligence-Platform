import csv
import datetime
import json
import uuid
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db.database import get_db
from app.db import models
from app.api.deps import get_current_user
from app.schemas import event as event_schema

router = APIRouter()

@router.get("/events", response_model=List[event_schema.Event])
@router.get("/incidents", response_model=List[event_schema.Event])
def get_events(
    facility_id: Optional[str] = None,
    risk_level: Optional[str] = None,
    behaviour: Optional[str] = None,
    bay_id: Optional[str] = None,
    camera_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Event)

    if current_user and current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(
            (models.Event.facility_id == current_user.facility_id) |
            (models.Event.facility_id == "FAC-001") |
            (models.Event.facility_id.is_(None))
        )
        if facility_id:
            query = query.filter(models.Event.facility_id == facility_id)
    elif facility_id:
        query = query.filter(models.Event.facility_id == facility_id)
    
    if risk_level and risk_level.strip().upper() != "ALL":
        query = query.filter(models.Event.risk_level.ilike(risk_level.strip()))
    if behaviour:
        query = query.filter(models.Event.behaviour.ilike(f"%{behaviour}%"))
    if bay_id:
        query = query.filter(models.Event.bay_id == bay_id)
    if camera_id:
        query = query.filter(models.Event.camera_id == camera_id)
        
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            models.Event.description.ilike(search_pattern) | 
            models.Event.reason.ilike(search_pattern) |
            models.Event.behaviour.ilike(search_pattern) |
            models.Event.event_id.ilike(search_pattern)
        )
        
    events = query.order_by(models.Event.timestamp.desc()).offset(skip).limit(limit).all()
    return events

@router.get("/events/export/csv")
@router.get("/incidents/export/csv")
def export_events_csv(
    facility_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Event)
    if facility_id:
        query = query.filter(models.Event.facility_id == facility_id)
    elif current_user and current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(models.Event.facility_id == current_user.facility_id)
    events = query.order_by(models.Event.timestamp.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "event_id", "video_id", "timestamp", "camera_id", "bay_id", 
        "behaviour", "risk_score", "risk_level", "description", "reason"
    ])
    
    for event in events:
        writer.writerow([
            event.event_id, event.video_id, event.timestamp, event.camera_id, 
            event.bay_id, event.behaviour, event.risk_score, event.risk_level, 
            event.description, event.reason
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=incidents_export.csv"}
    )

@router.get("/events/{event_id}", response_model=event_schema.Event)
@router.get("/incidents/{event_id}", response_model=event_schema.Event)
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Event).filter(models.Event.event_id == event_id)
    if current_user and current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(models.Event.facility_id == current_user.facility_id)
    event = query.first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


class StatusChangePayload(BaseModel):
    status: str
    comment: Optional[str] = None


VALID_TRANSITIONS = {
    "UNRESOLVED": ["ACKNOWLEDGED", "DISPATCHED", "UNDER_REVIEW", "PENDING_REVIEW", "CONFIRMED", "CONFIRMED_RISK", "FALSE_POSITIVE", "DISMISSED", "NEEDS_INVESTIGATION", "RESOLVED"],
    "OPEN": ["ACKNOWLEDGED", "DISPATCHED", "UNDER_REVIEW", "PENDING_REVIEW", "CONFIRMED", "CONFIRMED_RISK", "FALSE_POSITIVE", "DISMISSED", "NEEDS_INVESTIGATION", "RESOLVED"],
    "PENDING_REVIEW": ["ACKNOWLEDGED", "DISPATCHED", "UNDER_REVIEW", "CONFIRMED", "CONFIRMED_RISK", "FALSE_POSITIVE", "DISMISSED", "NEEDS_INVESTIGATION", "RESOLVED"],
    "ACKNOWLEDGED": ["DISPATCHED", "UNDER_REVIEW", "CONFIRMED", "CONFIRMED_RISK", "FALSE_POSITIVE", "DISMISSED", "NEEDS_INVESTIGATION", "RESOLVED"],
    "DISPATCHED": ["UNDER_REVIEW", "CONFIRMED", "CONFIRMED_RISK", "RESOLVED", "FALSE_POSITIVE", "DISMISSED", "NEEDS_INVESTIGATION"],
    "UNDER_REVIEW": ["CONFIRMED", "CONFIRMED_RISK", "FALSE_POSITIVE", "DISMISSED", "RESOLVED", "NEEDS_INVESTIGATION"],
    "NEEDS_INVESTIGATION": ["CONFIRMED", "CONFIRMED_RISK", "FALSE_POSITIVE", "DISMISSED", "RESOLVED"],
    "CONFIRMED_RISK": ["RESOLVED", "FALSE_POSITIVE", "DISMISSED", "UNDER_REVIEW"],
    "CONFIRMED": ["RESOLVED", "FALSE_POSITIVE", "DISMISSED", "UNDER_REVIEW"],
    "FALSE_POSITIVE": ["UNDER_REVIEW", "PENDING_REVIEW", "NEEDS_INVESTIGATION"],
    "DISMISSED": ["UNDER_REVIEW", "PENDING_REVIEW", "NEEDS_INVESTIGATION"],
    "RESOLVED": ["UNDER_REVIEW"]
}


@router.put("/events/{event_id}/status")
@router.put("/incidents/{event_id}/status")
def update_event_status(
    event_id: str,
    payload: StatusChangePayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Event).filter(models.Event.event_id == event_id)
    if current_user and current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(models.Event.facility_id == current_user.facility_id)
    event = query.first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    new_status = payload.status.upper().strip()
    current_status = (event.status or "UNRESOLVED").upper().strip()

    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status != current_status and new_status not in allowed:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid state transition from '{current_status}' to '{new_status}'. Allowed target states: {allowed}"
        )

    event.status = new_status
    if new_status in ["ACKNOWLEDGED", "DISPATCHED", "RESOLVED", "CONFIRMED", "FALSE_POSITIVE", "DISMISSED"]:
        event.acknowledged_by_user_id = current_user.id if current_user else None
        event.acknowledged_at = datetime.datetime.utcnow()
    event.updated_at = datetime.datetime.utcnow()

    # Log IncidentReview decision
    if new_status in ["FALSE_POSITIVE", "CONFIRMED", "CONFIRMED_RISK", "DISMISSED", "NEEDS_INVESTIGATION", "ACKNOWLEDGED", "DISPATCHED"]:
        review_id = f"REV-{uuid.uuid4().hex[:12]}"
        db.add(models.IncidentReview(
            id=review_id,
            event_id=event.event_id,
            reviewer_id=current_user.id if current_user else "REV-ANONYMOUS",
            decision=new_status,
            comment=payload.comment or f"Status changed to {new_status}",
            created_at=datetime.datetime.utcnow()
        ))

    # Create Audit Log entry
    try:
        db.add(models.AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12]}",
            organization_id=current_user.organization_id or "ORG-001",
            user_id=current_user.id,
            action=f"INCIDENT_STATUS_CHANGED_{new_status}",
            entity_type="EVENT",
            entity_id=event.event_id,
            metadata_json=json.dumps({
                "from_status": current_status,
                "to_status": new_status,
                "comment": payload.comment
            }),
            created_at=datetime.datetime.utcnow()
        ))
    except Exception:
        pass

    db.commit()
    db.refresh(event)
    return event


@router.post("/events", response_model=event_schema.Event, status_code=201)
@router.post("/incidents", response_model=event_schema.Event, status_code=201)
def create_event(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    event_id = payload.get("event_id") or f"EVT-{uuid.uuid4().hex[:8].upper()}"
    
    facility_id = payload.get("facility_id") or current_user.facility_id or "FAC-001"
    
    # Clean and sanitize attributes
    raw_timestamp = payload.get("timestamp")
    try:
        timestamp_val = float(raw_timestamp) if raw_timestamp is not None else datetime.datetime.utcnow().timestamp()
    except (ValueError, TypeError):
        timestamp_val = datetime.datetime.utcnow().timestamp()

    db_event = models.Event(
        event_id=event_id,
        organization_id=current_user.organization_id or "ORG-001",
        facility_id=facility_id,
        video_id=payload.get("video_id") or "live-optical-stream",
        camera_id=payload.get("camera_id") or "CAM-01",
        bay_id=payload.get("bay_id") or "Loading Bay 01",
        object_id=payload.get("object_id") or 42,
        timestamp=timestamp_val,
        timestamp_seconds=payload.get("timestamp_seconds") or timestamp_val,
        behaviour=payload.get("behaviour") or "Observed Material Handling Anomaly",
        risk_score=float(payload.get("risk_score") or 85.0),
        risk_level=payload.get("risk_level") or "High",
        description=payload.get("description") or f"Kinematic handling anomaly flagged at loading bay {payload.get('bay_id', 'Loading Bay 01')}.",
        reason=payload.get("reason") or "Abrupt acceleration impulse or unsafe spatial positioning detected by YOLO11 vision pipeline.",
        recommended_action=payload.get("recommended_action") or "Halt operations, check carton integrity, and provide ergonomic coaching.",
        status=payload.get("status") or "UNRESOLVED",
        model_name="YOLO11s",
        model_version="v1.4.2-tensorrt",
        inference_engine="LOCAL_YOLO11",
        confidence=0.92,
        provenance_type="LIVE_DETECTION",
        environment="PRODUCTION",
        is_test_data=False,
        is_demo_data=False,
        created_at=datetime.datetime.utcnow(),
        updated_at=datetime.datetime.utcnow()
    )

    db.add(db_event)
    
    # Log Audit entry
    try:
        db.add(models.AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12]}",
            organization_id=current_user.organization_id or "ORG-001",
            user_id=current_user.id,
            action="INCIDENT_REPORTED_LIVE",
            entity_type="EVENT",
            entity_id=event_id,
            metadata_json=json.dumps({"behaviour": db_event.behaviour, "risk_level": db_event.risk_level}),
            created_at=datetime.datetime.utcnow()
        ))
    except Exception:
        pass

    db.commit()
    db.refresh(db_event)
    return db_event
