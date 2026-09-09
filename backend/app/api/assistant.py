import re
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db import models
from app.schemas import assistant as assistant_schema
from app.integrations.gemini_client import gemini_client
from app.config import settings
from app.services.rag_store import rag_vector_store
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/assistant/chat", response_model=assistant_schema.ChatResponse)
async def chat(
    request: assistant_schema.ChatRequest, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Data-driven AI Operations Assistant Endpoint.
    Strictly answers ONLY using authorized application data retrieved from SQL database and RAG vector store.
    """
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    user_facility = current_user.facility_id or "FAC-001"
    requested_fac = request.facility_id

    # 1. Authentication & Facility Authorization Scope Enforcement
    if current_user.role != "ADMIN":
        target_facility_id = user_facility
        if requested_fac and requested_fac != user_facility:
            return assistant_schema.ChatResponse(
                answer=f"Access Denied: User '{current_user.email}' is scoped to facility '{user_facility}' and is unauthorized to access records for facility '{requested_fac}'.",
                citations=[],
                data_scope=assistant_schema.DataScope(
                    user_id=current_user.id or "USR-001",
                    user_role=current_user.role,
                    authorized_facility_id=user_facility,
                    requested_facility_id=requested_fac
                ),
                generated_at=now_iso,
                model="Security-Facility-Scope-Guard",
                retrieval_count=0,
                question=request.question,
                source_events=[],
                model_used="Security-Facility-Scope-Guard"
            )
    else:
        target_facility_id = requested_fac or user_facility

    # Inspect question prompt for unauthorized facility cross-references (e.g. FAC-002 asked by FAC-001 user)
    q_upper = request.question.upper()
    if current_user.role != "ADMIN":
        fac_matches = re.findall(r"FAC-\d+", q_upper)
        unauthorized_facs = [f for f in fac_matches if f != target_facility_id]
        if unauthorized_facs:
            return assistant_schema.ChatResponse(
                answer=f"Access Denied: User '{current_user.email}' (Role: {current_user.role}) is scoped to facility '{target_facility_id}' and does not have authorization to view records for {', '.join(unauthorized_facs)}.",
                citations=[],
                data_scope=assistant_schema.DataScope(
                    user_id=current_user.id or "USR-001",
                    user_role=current_user.role,
                    authorized_facility_id=target_facility_id,
                    requested_facility_id=unauthorized_facs[0]
                ),
                generated_at=now_iso,
                model="Security-Facility-Scope-Guard",
                retrieval_count=0,
                question=request.question,
                source_events=[],
                model_used="Security-Facility-Scope-Guard"
            )

    # 2. SQL Retrieval - Filtered strictly by authorized facility_id and excluding demo/test fixtures
    events_query = db.query(models.Event).filter(
        models.Event.facility_id == target_facility_id,
        or_(models.Event.is_demo_data == False, models.Event.is_demo_data.is_(None)),
        or_(models.Event.is_test_data == False, models.Event.is_test_data.is_(None)),
        or_(models.Event.provenance_type != "DEMO_FIXTURE", models.Event.provenance_type.is_(None))
    )
    if request.camera_id:
        events_query = events_query.filter(models.Event.camera_id == request.camera_id)
    if request.bay_id:
        events_query = events_query.filter(models.Event.bay_id == request.bay_id)

    # Specific event ID query handling
    evt_ids = re.findall(r"EVT-[A-Z0-9-]+", q_upper)
    specific_event_requested = bool(evt_ids)

    if specific_event_requested:
        events_query = events_query.filter(models.Event.event_id.in_(evt_ids))

    sql_events = events_query.order_by(models.Event.timestamp.desc()).limit(10).all()

    # 3. Vector Retrieval (ChromaDB)
    rag_matches = []
    try:
        rag_matches = rag_vector_store.query_incidents(
            query_text=request.question,
            n_results=4,
            facility_id=target_facility_id
        )
    except Exception as e:
        print(f"[Assistant] Vector store query error (falling back to SQL): {e}")

    # 4. Construct Citations List
    citations_dict = {}
    for e in sql_events:
        ts_val = e.timestamp_seconds if e.timestamp_seconds is not None else e.timestamp
        citations_dict[e.event_id] = assistant_schema.Citation(
            event_id=e.event_id,
            timestamp=float(ts_val or 0.0),
            facility_id=e.facility_id or target_facility_id,
            bay_id=e.bay_id,
            camera_id=e.camera_id,
            behaviour=e.behaviour or "Anomaly",
            description=e.description or e.reason or "Recorded safety incident",
            source_document="SQL_EVENT_DB"
        )

    for m in rag_matches:
        meta = m.get("metadata", {})
        m_id = meta.get("event_id") or meta.get("id")
        m_fac = meta.get("facility_id", target_facility_id)
        if specific_event_requested and m_id not in evt_ids:
            continue
        if request.bay_id and meta.get("bay_id") and meta.get("bay_id") != request.bay_id:
            continue
        if request.camera_id and meta.get("camera_id") and meta.get("camera_id") != request.camera_id:
            continue
        if m_id and m_id not in citations_dict and (current_user.role == "ADMIN" or m_fac == target_facility_id):
            citations_dict[m_id] = assistant_schema.Citation(
                event_id=m_id,
                timestamp=float(meta.get("timestamp", 0.0)),
                facility_id=m_fac,
                bay_id=meta.get("bay_id"),
                camera_id=meta.get("camera_id"),
                behaviour=meta.get("behaviour", "Violation"),
                description=m.get("text", "Vector store match"),
                source_document="CHROMADB_VECTOR_STORE"
            )

    citations = list(citations_dict.values())
    retrieval_count = len(citations)

    data_scope_obj = assistant_schema.DataScope(
        user_id=current_user.id or "USR-001",
        user_role=current_user.role,
        authorized_facility_id=target_facility_id,
        requested_facility_id=requested_fac
    )

    # 5. Empty Retrieval / Non-existent Incident / Insufficient Evidence Handling
    if retrieval_count == 0:
        if specific_event_requested:
            ans_text = f"No verified warehouse events are available matching '{', '.join(evt_ids)}' for facility '{target_facility_id}' and time range."
        else:
            ans_text = "No verified warehouse events are available for this facility and time range."

        return assistant_schema.ChatResponse(
            answer=ans_text,
            citations=[],
            data_scope=data_scope_obj,
            generated_at=now_iso,
            model="Grounded-Rule-Engine",
            retrieval_count=0,
            question=request.question,
            source_events=[],
            model_used="Grounded-Rule-Engine"
        )

    # 6. Context Construction for LLM Prompt
    context_lines = [
        f"• Event ID: {c.event_id} | Facility: {c.facility_id} | Timestamp: {c.timestamp:.2f}s | "
        f"Bay: {c.bay_id or 'Dock'} | Camera: {c.camera_id or 'CAM-01'} | "
        f"Behaviour: {c.behaviour} | Description: {c.description}"
        for c in citations
    ]
    context_str = "\n".join(context_lines)

    prompt = (
        f"You are the Warehouse AI Intelligence Assistant.\n"
        f"STRICT GROUNDING RULE: Answer the supervisor's question using ONLY the retrieved database records below for facility {target_facility_id}.\n"
        f"Do NOT invent numbers, incidents, or facts outside of this retrieved data.\n"
        f"If the question cannot be answered using this context, state clearly: 'Insufficient evidence in database records.'\n\n"
        f"Retrieved Records ({retrieval_count}):\n{context_str}\n\n"
        f"Supervisor Question: {request.question}"
    )

    # 7. LLM Response Generation & Fallback
    model_name = "gemini-2.5-flash"
    answer_text = None

    if gemini_client.is_configured():
        try:
            raw_answer = await gemini_client.generate_response(prompt, system_prompt=settings.SYSTEM_ASSISTANT_PROMPT)
            if raw_answer:
                answer_text = raw_answer
                model_name = gemini_client.model or "gemini-2.5-flash"
        except Exception as e:
            print(f"[Assistant] Gemini API error: {e}. Falling back to grounded SQL summary.")

    if not answer_text:
        model_name = "SQL+RAG-Local-Grounded"
        summary_lines = [
            f"Based on {retrieval_count} verified records in facility '{target_facility_id}':\n"
        ]
        for c in citations[:4]:
            summary_lines.append(
                f"• Incident {c.event_id} (Bay {c.bay_id or '1'} @ t={c.timestamp:.2f}s): {c.behaviour}. {c.description}"
            )
        answer_text = "\n".join(summary_lines)

    return assistant_schema.ChatResponse(
        answer=answer_text,
        citations=citations,
        data_scope=data_scope_obj,
        generated_at=now_iso,
        model=model_name,
        retrieval_count=retrieval_count,
        question=request.question,
        source_events=citations,
        model_used=model_name
    )
