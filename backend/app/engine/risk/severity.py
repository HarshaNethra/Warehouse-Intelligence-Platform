"""
Base Severity Mapping for Behaviour Incidents.
"""

from typing import Optional
from app.engine.risk.config import DEFAULT_RISK_CONFIG, RiskConfig


def get_base_severity(behaviour_type: str, config: Optional[RiskConfig] = None) -> float:
    """
    Retrieves the baseline severity score for a detected behaviour type.
    Falls back to 'default' if behaviour is unrecognized.
    """
    cfg = config or DEFAULT_RISK_CONFIG
    return cfg.base_severities.get(behaviour_type, cfg.base_severities["default"])
