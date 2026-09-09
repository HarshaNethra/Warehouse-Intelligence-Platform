"""
Event Builder: Assembles canonical structured incident events from Behaviour Candidates.
"""

from typing import Any, Dict, List, Optional
from behaviour_engine.base_rule import BehaviourCandidate


def build_event(candidate: BehaviourCandidate,
                video_id: str,
                event_index: int = 1,
                fps: float = 30.0,
                risk_score: Optional[int] = None,
                risk_level: Optional[str] = None,
                explanation: Optional[str] = None,
                recommended_action: Optional[str] = None) -> Dict[str, Any]:
    """
    Constructs a canonical event dictionary strictly complying with the PRD contract.
    """
    start_ts = round(candidate.start_frame / fps, 2)
    end_ts = round(candidate.end_frame / fps, 2)
    duration_s = max(0.1, round(end_ts - start_ts, 2))

    # Evidence frame is the midpoint or point of impact
    evidence_frame = int((candidate.start_frame + candidate.end_frame) // 2)

    event_id = f"EVT-{video_id[:6].upper().replace(' ', '')}-{event_index:03d}"

    # Default description & reason if not overridden by risk engine
    reason_text = explanation or candidate.description or f"Triggered by {candidate.rule_name}"
    action_text = recommended_action or "Review video footage at evidence frame and verify handling procedure."

    return {
        "event_id": event_id,
        "video_id": video_id,
        "timestamp": start_ts,
        "start_timestamp": start_ts,
        "end_timestamp": end_ts,
        "duration": duration_s,
        "object_id": candidate.object_id,
        "behaviour": candidate.behaviour_type,
        "confidence": candidate.confidence,
        "risk_score": risk_score if risk_score is not None else 50,
        "risk_level": risk_level if risk_level is not None else "medium",
        "description": candidate.description,
        "reason": reason_text,
        "evidence_frame": evidence_frame,
        "recommended_action": action_text,
        "evidence": candidate.evidence,
    }


def build_events_from_candidates(candidates: List[BehaviourCandidate],
                                 video_id: str,
                                 fps: float = 30.0) -> List[Dict[str, Any]]:
    """Builds a list of events from candidates with sequential IDs."""
    events = []
    for idx, c in enumerate(candidates, 1):
        events.append(build_event(c, video_id=video_id, event_index=idx, fps=fps))
    return events
