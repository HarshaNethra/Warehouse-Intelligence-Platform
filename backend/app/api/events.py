from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Response
from typing import List, Optional
from app.schemas.event import EventResponse, EventFilterParams
from app.services import event_service

router = APIRouter(prefix="/events", tags=["Events"])

@router.get("", response_model=List[EventResponse])
def list_events(
    risk_level: Optional[str] = Query(None, description="Filter by risk level: Low, Medium, High, Critical"),
    behaviour: Optional[str] = Query(None, description="Filter by behaviour substring"),
    bay_id: Optional[str] = Query(None, description="Filter by bay identifier"),
    camera_id: Optional[str] = Query(None, description="Filter by camera identifier"),
    search: Optional[str] = Query(None, description="Search query across description, behaviour, reason"),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0)
):
    params = EventFilterParams(
        risk_level=risk_level,
        behaviour=behaviour,
        bay_id=bay_id,
        camera_id=camera_id,
        search=search,
        limit=limit,
        skip=skip
    )
    return event_service.get_events(params)

@router.get("/export/csv")
def export_events_csv(
    risk_level: Optional[str] = Query(None, description="Filter by risk level: Low, Medium, High, Critical"),
    behaviour: Optional[str] = Query(None, description="Filter by behaviour substring"),
    bay_id: Optional[str] = Query(None, description="Filter by bay identifier"),
    camera_id: Optional[str] = Query(None, description="Filter by camera identifier"),
    search: Optional[str] = Query(None, description="Search query across description, behaviour, reason"),
    limit: int = Query(5000, ge=1, le=10000, description="Maximum number of events to export")
):
    params = EventFilterParams(
        risk_level=risk_level,
        behaviour=behaviour,
        bay_id=bay_id,
        camera_id=camera_id,
        search=search,
        limit=limit,
        skip=0
    )
    csv_content = event_service.generate_events_csv(params)
    filename = f"warehouse_incidents_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: str):
    event = event_service.get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event with id '{event_id}' not found")
    return event

