import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.db import models
from app.api.deps import get_current_user
from app.schemas import event as event_schema
from app.schemas import assistant as assistant_schema
from app.integrations.gemini_client import gemini_client
from app.config import settings
from app.services.rag_store import rag_vector_store
from app.services.websocket_manager import ws_manager

router = APIRouter()

class RAGChatRequest(BaseModel):
    question: Optional[str] = None
    query: Optional[str] = None
    prompt: Optional[str] = None
    camera_id: Optional[str] = None
    bay_id: Optional[str] = None

    def get_query_text(self) -> str:
        return self.question or self.query or self.prompt or "Summarize warehouse safety incidents."

class BatchDeleteRequest(BaseModel):
    incident_ids: List[str]

class BatchStatusUpdateRequest(BaseModel):
    incident_ids: List[str]
    status: str = "ACKNOWLEDGED"


@router.get("/incidents", response_model=List[event_schema.Event])
def get_incidents(
    risk_level: Optional[str] = Query(None, description="Filter by risk severity: CRITICAL, HIGH, MEDIUM, LOW, ALL"),
    behaviour: Optional[str] = None,
    bay_id: Optional[str] = None,
    camera_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query = db.query(models.Event)

    # Multi-tenant Facility Scoping Filter
    if current_user and current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(
            (models.Event.facility_id == current_user.facility_id) | (models.Event.facility_id.is_(None))
        )

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


@router.get("/incidents/{id}", response_model=event_schema.Event)
def get_incident_by_id(
    id: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Event).filter(models.Event.event_id == id)
    if current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(
            (models.Event.facility_id == current_user.facility_id) | (models.Event.facility_id.is_(None))
        )
    event = query.first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Incident with ID '{id}' not found in authorized facility")
    return event


@router.post("/incidents/{id}/acknowledge", response_model=event_schema.Event)
async def acknowledge_incident(
    id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Operator Action Attribution: Marks incident as ACKNOWLEDGED and attributes to current_user.
    """
    query = db.query(models.Event).filter(models.Event.event_id == id)
    if current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(
            (models.Event.facility_id == current_user.facility_id) | (models.Event.facility_id.is_(None))
        )
    event = query.first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Incident with ID '{id}' not found in authorized facility")

    event.status = "ACKNOWLEDGED"
    event.acknowledged_by_user_id = current_user.id
    event.acknowledged_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(event)

    # Write AuditLog entry
    try:
        db.add(models.AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12]}",
            organization_id=current_user.organization_id or "ORG-001",
            user_id=current_user.id,
            action="INCIDENT_ACKNOWLEDGED",
            entity_type="INCIDENT",
            entity_id=event.event_id,
            created_at=datetime.datetime.utcnow()
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Routes] Audit log warning: {e}")

    # Broadcast status change to live WebSocket listeners
    try:
        await ws_manager.broadcast_telemetry({
            "action": "INCIDENT_ACKNOWLEDGED",
            "event_id": event.event_id,
            "status": "ACKNOWLEDGED",
            "user_id": current_user.id,
            "user_email": current_user.email,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }, facility_id=event.facility_id)
    except Exception as e:
        print(f"[Routes] WebSocket broadcast warning: {e}")

    return event


@router.post("/incidents/{id}/dispatch", response_model=event_schema.Event)
async def dispatch_incident(
    id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Operator Action Attribution: Marks incident as DISPATCHED for supervisor action.
    """
    query = db.query(models.Event).filter(models.Event.event_id == id)
    if current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(
            (models.Event.facility_id == current_user.facility_id) | (models.Event.facility_id.is_(None))
        )
    event = query.first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Incident with ID '{id}' not found in authorized facility")

    event.status = "DISPATCHED"
    if not event.acknowledged_by_user_id:
        event.acknowledged_by_user_id = current_user.id
        event.acknowledged_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(event)

    try:
        db.add(models.AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12]}",
            organization_id=current_user.organization_id or "ORG-001",
            user_id=current_user.id,
            action="INCIDENT_DISPATCHED",
            entity_type="INCIDENT",
            entity_id=event.event_id,
            created_at=datetime.datetime.utcnow()
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Routes] Audit log warning: {e}")

    try:
        await ws_manager.broadcast_telemetry({
            "action": "INCIDENT_DISPATCHED",
            "event_id": event.event_id,
            "status": "DISPATCHED",
            "user_id": current_user.id,
            "user_email": current_user.email,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }, facility_id=event.facility_id)
    except Exception as e:
        print(f"[Routes] WebSocket broadcast warning: {e}")

    return event


@router.post("/incidents/{id}/false-positive", response_model=event_schema.Event)
async def mark_false_positive(
    id: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Responsible AI Review: Marks incident as FALSE_POSITIVE and records feedback for ML retraining.
    """
    query = db.query(models.Event).filter(models.Event.event_id == id)
    if current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(
            (models.Event.facility_id == current_user.facility_id) | (models.Event.facility_id.is_(None))
        )
    event = query.first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Incident with ID '{id}' not found in authorized facility")

    event.status = "FALSE_POSITIVE"
    event.acknowledged_by_user_id = current_user.id
    event.acknowledged_at = datetime.datetime.utcnow()

    # Record review decision
    review = models.IncidentReview(
        id=f"REV-{uuid.uuid4().hex[:12]}",
        event_id=event.event_id,
        reviewer_id=current_user.id,
        decision="FALSE_POSITIVE",
        comment=reason or "Marked as false positive by supervisor",
        created_at=datetime.datetime.utcnow()
    )
    db.add(review)

    # Add audit log
    db.add(models.AuditLog(
        id=f"AUD-{uuid.uuid4().hex[:12]}",
        organization_id=current_user.organization_id or "ORG-001",
        user_id=current_user.id,
        action="INCIDENT_FALSE_POSITIVE",
        entity_type="INCIDENT",
        entity_id=event.event_id,
        metadata_json=f'{{"reason": "{reason or ""}"}}',
        created_at=datetime.datetime.utcnow()
    ))

    db.commit()
    db.refresh(event)

    try:
        await ws_manager.broadcast_telemetry({
            "action": "INCIDENT_FALSE_POSITIVE",
            "event_id": event.event_id,
            "status": "FALSE_POSITIVE",
            "user_id": current_user.id,
            "timestamp": datetime.datetime.utcnow().isoformat()
        })
    except Exception as e:
        print(f"[Routes] WebSocket broadcast warning: {e}")

    return event


@router.delete("/incidents/batch")
async def batch_delete_incidents(
    payload: BatchDeleteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Deletes matching incident records from SQL DB and ChromaDB vector store memory.
    Enforces multi-tenant facility scoping.
    """
    if not payload.incident_ids:
        return {"deleted_count": 0, "deleted_ids": [], "status": "success"}

    query = db.query(models.Event).filter(models.Event.event_id.in_(payload.incident_ids))
    if current_user and current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(
            (models.Event.facility_id == current_user.facility_id) | (models.Event.facility_id.is_(None))
        )

    matched_events = query.all()
    deleted_ids = [e.event_id for e in matched_events]

    if deleted_ids:
        # 1. Delete from SQL DB
        query.delete(synchronize_session=False)
        db.commit()

        # 2. Scrub from ChromaDB vector store
        try:
            rag_vector_store.delete_incidents(deleted_ids)
        except Exception as e:
            print(f"[Routes] Vector store delete warning: {e}")

        # 3. Broadcast WebSocket notification
        try:
            await ws_manager.broadcast_telemetry({
                "action": "INCIDENTS_BATCH_DELETED",
                "incident_ids": deleted_ids,
                "user_id": current_user.id,
                "user_email": current_user.email,
                "timestamp": datetime.datetime.utcnow().isoformat()
            })
        except Exception as e:
            print(f"[Routes] WebSocket broadcast warning: {e}")

    return {
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "status": "success"
    }


@router.patch("/incidents/batch-status")
async def batch_update_incident_status(
    payload: BatchStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Updates status and operator attribution for multiple incidents in bulk.
    Enforces multi-tenant facility scoping.
    """
    if not payload.incident_ids:
        return {"updated_count": 0, "incident_ids": [], "status": payload.status}

    new_status = payload.status.strip().upper()
    query = db.query(models.Event).filter(models.Event.event_id.in_(payload.incident_ids))
    if current_user and current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(
            (models.Event.facility_id == current_user.facility_id) | (models.Event.facility_id.is_(None))
        )

    matched_events = query.all()
    updated_ids = []
    now = datetime.datetime.utcnow()

    for event in matched_events:
        event.status = new_status
        event.acknowledged_by_user_id = current_user.id
        event.acknowledged_at = now
        updated_ids.append(event.event_id)

    if updated_ids:
        db.commit()
        try:
            await ws_manager.broadcast_telemetry({
                "action": "INCIDENTS_BATCH_STATUS_UPDATED",
                "incident_ids": updated_ids,
                "status": new_status,
                "user_id": current_user.id,
                "user_email": current_user.email,
                "timestamp": now.isoformat()
            })
        except Exception as e:
            print(f"[Routes] WebSocket broadcast warning: {e}")

    return {
        "updated_count": len(updated_ids),
        "incident_ids": updated_ids,
        "status": new_status
    }


@router.post("/chat/rag", response_model=assistant_schema.ChatResponse)
async def chat_rag(
    request: RAGChatRequest, 
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query_text = request.get_query_text()

    # 1. Query ChromaDB / RAG Vector Store
    rag_matches = rag_vector_store.query_similar_incidents(query_text, n_results=4)
    rag_texts = [m["text"] for m in rag_matches]

    # 2. Query SQL Database with Multi-Tenant Facility Scoping
    events_query = db.query(models.Event)
    if current_user and current_user.facility_id and current_user.role != "ADMIN":
        events_query = events_query.filter(
            (models.Event.facility_id == current_user.facility_id) | (models.Event.facility_id.is_(None))
        )
    if request.camera_id:
        events_query = events_query.filter(models.Event.camera_id == request.camera_id)
    if request.bay_id:
        events_query = events_query.filter(models.Event.bay_id == request.bay_id)
        
    recent_events = events_query.order_by(models.Event.timestamp.desc()).limit(settings.ASSISTANT_CONTEXT_LIMIT).all()
    
    source_events = [
        assistant_schema.SourceEvent(
            event_id=e.event_id,
            behaviour=e.behaviour,
            risk_level=e.risk_level,
            risk_score=round(e.risk_score, 1),
            timestamp=e.timestamp,
            bay_id=e.bay_id,
            description=e.description
        ) for e in recent_events
    ]

    # 3. Construct RAG Context Prompt
    rag_context_str = "\n".join([f"• RAG Match: {t}" for t in rag_texts])
    db_context_str = "\n".join([
        f"- Event ID: {e.event_id} | Risk: [{e.risk_level}] (Score: {e.risk_score:.1f}) | Behaviour: {e.behaviour} | Bay: {e.bay_id or 'Dock'} | Reason: {e.reason}"
        for e in recent_events
    ])
    
    full_prompt = f"ChromaDB Vector Search Context:\n{rag_context_str}\n\nObserved Database Incidents:\n{db_context_str}\n\nSupervisor Question: {query_text}"

    if not gemini_client.is_configured():
        lines = [
            f"Based on ChromaDB RAG Vector Store & SQL Database records ({len(rag_matches)} vector hits):",
            ""
        ]
        for m in rag_matches:
            lines.append(f"• Vector Search Match: {m['text']}")
        
        lines.append("\nRecent Flagged Incidents in Database:")
        for e in recent_events[:3]:
            lines.append(
                f"• [{e.risk_level} Risk - Score {e.risk_score:.1f}] {e.behaviour} in {e.bay_id or 'Bay 1'}. "
                f"Description: {e.description}"
            )
            
        return assistant_schema.ChatResponse(
            question=query_text,
            answer="\n".join(lines),
            source_events=source_events,
            model_used="ChromaDB RAG + Local Intelligence"
        )

    answer = await gemini_client.generate_response(full_prompt, system_prompt=settings.SYSTEM_ASSISTANT_PROMPT)
    if not answer:
        raise HTTPException(status_code=500, detail="Failed to generate RAG response from Gemini API")

    return assistant_schema.ChatResponse(
        question=query_text,
        answer=answer,
        source_events=source_events,
        model_used=gemini_client.model
    )
