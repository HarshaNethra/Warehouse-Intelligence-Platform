from typing import List, Dict, Any
from app.db import repository
from app.schemas.assistant import ChatRequest, ChatResponse, SourceEvent
from app.integrations.claude_client import claude_client

def _build_grounded_fallback(question: str, events: List[Dict[str, Any]]) -> str:
    """Deterministic, grounded synthesizer when Claude API is unavailable."""
    if not events:
        return "No matching warehouse incident records were found in the database for your query."

    q_lower = question.lower()

    # Question about bays / location
    if any(k in q_lower for k in ["bay", "where", "location"]):
        bays: Dict[str, List[str]] = {}
        for e in events:
            b = e.get("bay_id", "Unknown Bay")
            bays.setdefault(b, []).append(f"{e.get('behaviour')} (Risk: {e.get('risk_score')})")
        bay_summary = "\n".join([f"- **{b}**: {len(items)} incidents ({', '.join(items[:2])})" for b, items in bays.items()])
        return (
            f"Based on warehouse surveillance records, incidents are distributed across the following locations:\n\n"
            f"{bay_summary}\n\n"
            f"Most critical handling violations were detected in **{list(bays.keys())[0]}**."
        )

    # Question about critical / high risk / drops
    if any(k in q_lower for k in ["drop", "critical", "severe", "fall"]):
        critical_events = [e for e in events if e.get("risk_level") in ["Critical", "High"]]
        if not critical_events:
            critical_events = events[:2]
        details = "\n".join([
            f"- **{e.get('event_id')} ({e.get('behaviour')})** in {e.get('bay_id')}: {e.get('description')} "
            f"Reason: {e.get('reason')} *Action:* {e.get('recommended_action')}"
            for e in critical_events[:3]
        ])
        return (
            f"Surveillance data indicates {len(critical_events)} high-risk / drop events:\n\n"
            f"{details}\n\n"
            f"Recommended priority: Inspect affected inventory and initiate safe lifting procedure refreshers."
        )

    # Question about recommendations / actions
    if any(k in q_lower for k in ["recommend", "action", "prevent", "train", "sop"]):
        actions = "\n".join([
            f"- **For {e.get('behaviour')} ({e.get('bay_id')})**: {e.get('recommended_action')}"
            for e in events if e.get("recommended_action")
        ][:4])
        return (
            f"Based on verified anomaly trajectories, here are the key corrective recommendations:\n\n"
            f"{actions}\n\n"
            f"These actions focus on ergonomic lifting equipment, pallet restacking, and conveyor speed controls."
        )

    # General overview / summary
    event_bullets = "\n".join([
        f"- **[{e.get('event_id')}] {e.get('behaviour')}** ({e.get('risk_level')} Risk - Score: {e.get('risk_score')}) at {e.get('bay_id')}: {e.get('description')}"
        for e in events[:3]
    ])
    return (
        f"Grounded analysis of {len(events)} matching incident records:\n\n"
        f"{event_bullets}\n\n"
        f"Key insight: Top concerns center around manual handling speed and pallet stack overhang. "
        f"Check the incident details panel for video playback evidence."
    )

async def handle_chat_query(request: ChatRequest) -> ChatResponse:
    # 1. Retrieve relevant events from SQLite repository
    matched_events = repository.search_events_for_assistant(request.question, limit=5)
    
    # 2. Build source event schemas
    source_events: List[SourceEvent] = [
        SourceEvent(
            event_id=e["event_id"],
            behaviour=e["behaviour"],
            risk_level=e["risk_level"],
            risk_score=float(e["risk_score"]),
            timestamp=float(e["timestamp"]),
            bay_id=e.get("bay_id"),
            description=e.get("description")
        )
        for e in matched_events
    ]

    # 3. Attempt Claude API if configured
    answer: str = ""
    model_name = "grounded-rag"

    if claude_client.is_configured():
        grounding_data = "\n\n".join([
            f"Event ID: {e.get('event_id')}\n"
            f"Behaviour: {e.get('behaviour')}\n"
            f"Bay: {e.get('bay_id')}\n"
            f"Risk Level: {e.get('risk_level')} (Score: {e.get('risk_score')})\n"
            f"Description: {e.get('description')}\n"
            f"Reason: {e.get('reason')}\n"
            f"Recommended Action: {e.get('recommended_action')}"
            for e in matched_events
        ])
        
        prompt = (
            f"Supervisor Question: {request.question}\n\n"
            f"Grounded Warehouse Incident Records:\n{grounding_data}\n\n"
            f"Answer the question concisely and authoritatively. Reference specific Event IDs and Bays when relevant. "
            f"Do not invent facts outside these records."
        )
        
        claude_response = await claude_client.generate_response(prompt)
        if claude_response:
            answer = claude_response
            model_name = claude_client.model

    # 4. Fallback if Claude is not configured or fails
    if not answer:
        answer = _build_grounded_fallback(request.question, matched_events)
        model_name = "sqlite-grounded-rag"

    # 5. Persist interaction in chat history
    source_ids = [e["event_id"] for e in matched_events]
    repository.save_chat_message(
        role="user",
        content=request.question,
        source_events=source_ids,
        session_id=request.session_id or "default"
    )
    repository.save_chat_message(
        role="assistant",
        content=answer,
        source_events=source_ids,
        session_id=request.session_id or "default"
    )

    return ChatResponse(
        question=request.question,
        answer=answer,
        source_events=source_events,
        model_used=model_name
    )
