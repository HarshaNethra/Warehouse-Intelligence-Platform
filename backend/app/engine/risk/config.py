"""
Centralized Configuration for the Risk Engine.

Defines:
- Risk category boundaries (Low: 0-29, Medium: 30-59, High: 60-84, Critical: 85-100)
- Baseline severities for all behaviour types
- Multi-factor weights and factor parameter boundaries
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class RiskConfig:
    """
    Risk parameters and scoring thresholds.
    """

    # -------------------------------------------------------------------------
    # Score Boundaries
    # -------------------------------------------------------------------------
    low_max: int = 29
    medium_max: int = 59
    high_max: int = 84
    critical_min: int = 85

    score_min: int = 0
    score_max: int = 100

    # -------------------------------------------------------------------------
    # Base Behaviour Severities (out of 100)
    # -------------------------------------------------------------------------
    base_severities: Dict[str, float] = field(default_factory=lambda: {
        "stepping_on_cartons": 65.0,
        "product_thrown": 60.0,
        "product_dropped": 50.0,
        "rough_handling": 45.0,
        "unstable_stack": 40.0,
        "designated_area_violation": 40.0,
        "product_dragged": 35.0,
        "improper_stacking": 30.0,
        "equipment_violation": 30.0,
        "default": 35.0,
    })

    # -------------------------------------------------------------------------
    # Factor Weights (applied to normalized factor values [0, 30])
    # -------------------------------------------------------------------------
    impact_weight: float = 0.35
    height_weight: float = 0.30
    duration_weight: float = 0.25
    frequency_weight: float = 0.20
    location_weight: float = 0.25


DEFAULT_RISK_CONFIG = RiskConfig()
