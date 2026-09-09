"""
Risk Engine Pipeline: Enriches Behaviour Candidates with Multi-Factor Risk Scores and Canonical Events.
"""

from typing import Any, Dict, List, Optional
from collections import Counter

from behaviour_engine.base_rule import BehaviourCandidate
from behaviour_engine.event_builder import build_event
from risk_engine.classifier import classify_risk
from risk_engine.config import DEFAULT_RISK_CONFIG, RiskConfig
from risk_engine.explanation import generate_explanation
from risk_engine.factors import extract_factors_from_evidence
from risk_engine.scorer import calculate_risk_score


def score_and_build_events(candidates: List[BehaviourCandidate],
                           video_id: str,
                           fps: float = 30.0,
                           config: Optional[RiskConfig] = None) -> List[Dict[str, Any]]:
    """
    Takes detected BehaviourCandidates, computes risk scores, factor breakdowns,
    explanations, and produces canonical events.
    """
    cfg = config or DEFAULT_RISK_CONFIG
    events: List[Dict[str, Any]] = []

    # Track frequency of each behaviour type across the video session
    behaviour_counts = Counter(c.behaviour_type for c in candidates)

    for idx, candidate in enumerate(candidates, 1):
        duration_s = max(0.1, (candidate.end_frame - candidate.start_frame) / fps)
        repetition_count = behaviour_counts[candidate.behaviour_type]

        # 1. Extract and calculate bounded factors
        factors = extract_factors_from_evidence(
            candidate.evidence,
            duration_s=duration_s,
            repetition_count=repetition_count,
            video_id=video_id,
        )

        # 2. Calculate deterministic score
        score = calculate_risk_score(candidate.behaviour_type, factors, cfg)

        # 3. Classify category
        level = classify_risk(score, cfg)

        # 4. Generate explainable reason & supervisor action
        reason, action = generate_explanation(
            candidate.behaviour_type,
            level,
            score,
            factors,
            candidate.evidence,
        )

        # 5. Build canonical event record
        event = build_event(
            candidate,
            video_id=video_id,
            event_index=idx,
            fps=fps,
            risk_score=score,
            risk_level=level,
            explanation=reason,
            recommended_action=action,
        )

        # Attach factor breakdown inside evidence for transparency
        event["evidence"]["risk_factors"] = factors

        events.append(event)

    return events
