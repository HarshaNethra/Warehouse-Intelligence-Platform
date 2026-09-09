"""
Deterministic Risk Scorer: Combines base severity and weighted measurable factors.
"""

from typing import Dict, Optional
from risk_engine.config import DEFAULT_RISK_CONFIG, RiskConfig
from risk_engine.severity import get_base_severity


def calculate_risk_score(behaviour_type: str,
                         factors: Dict[str, float],
                         config: Optional[RiskConfig] = None) -> int:
    """
    Computes an integer risk score in range [0, 100]:
        Score = clamp(Base + sum(factor * weight))
    """
    cfg = config or DEFAULT_RISK_CONFIG
    base = get_base_severity(behaviour_type, cfg)

    # Weighted addition of active factors
    factor_addition = (
        (factors.get("impact_factor", 0.0) * cfg.impact_weight)
        + (factors.get("height_factor", 0.0) * cfg.height_weight)
        + (factors.get("duration_factor", 0.0) * cfg.duration_weight)
        + (factors.get("frequency_factor", 0.0) * cfg.frequency_weight)
        + (factors.get("location_factor", 0.0) * cfg.location_weight)
    )

    raw_score = base + factor_addition
    clamped = max(cfg.score_min, min(cfg.score_max, int(round(raw_score))))
    return clamped
