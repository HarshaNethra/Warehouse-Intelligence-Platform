import csv
import io
from typing import List, Optional, Dict, Any
from app.db import repository
from app.schemas.event import EventFilterParams

def get_events(params: Optional[EventFilterParams] = None) -> List[Dict[str, Any]]:
    if params:
        return repository.get_events(
            risk_level=params.risk_level,
            behaviour=params.behaviour,
            bay_id=params.bay_id,
            camera_id=params.camera_id,
            search=params.search,
            limit=params.limit,
            skip=params.skip
        )
    return repository.get_events()

def get_event_by_id(event_id: str) -> Optional[Dict[str, Any]]:
    return repository.get_event_by_id(event_id)

def generate_events_csv(params: Optional[EventFilterParams] = None) -> str:
    """Generate RFC 4180 compliant CSV of filtered events with UTF-8 BOM."""
    effective_limit = params.limit if (params and params.limit > 100) else 5000
    events = repository.get_events(
        risk_level=params.risk_level if params else None,
        behaviour=params.behaviour if params else None,
        bay_id=params.bay_id if params else None,
        camera_id=params.camera_id if params else None,
        search=params.search if params else None,
        limit=effective_limit,
        skip=params.skip if params else 0
    )

    output = io.StringIO()
    # Write UTF-8 BOM for Microsoft Excel and standard spreadsheet compatibility
    output.write('\ufeff')
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL, lineterminator='\r\n')

    # Header row
    writer.writerow([
        "Event ID",
        "Video ID",
        "Timestamp (s)",
        "Bay ID",
        "Camera ID",
        "Behaviour",
        "Risk Level",
        "Risk Score",
        "Description",
        "Reason",
        "Recommended Action",
        "Created At"
    ])

    for ev in events:
        writer.writerow([
            ev.get("event_id", ""),
            ev.get("video_id", ""),
            ev.get("timestamp", ""),
            ev.get("bay_id", "") or "Unassigned",
            ev.get("camera_id", "") or "",
            ev.get("behaviour", ""),
            ev.get("risk_level", ""),
            ev.get("risk_score", ""),
            ev.get("description", ""),
            ev.get("reason", ""),
            ev.get("recommended_action", "") or "",
            ev.get("created_at", "") or ""
        ])

    return output.getvalue()

