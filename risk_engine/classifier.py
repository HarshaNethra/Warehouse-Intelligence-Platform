"""
Risk Level Classifier: Maps numeric score [0, 100] to Low, Medium, High, Critical.
"""

from typing import Optional
from risk_engine.config import DEFAULT_RISK_CONFIG, RiskConfig


def classify_risk(score: int, config: Optional[RiskConfig] = None) -> str:
    """
    Categorizes score into one of:
      - 'low'      (0 - 34)
      - 'medium'   (35 - 59)
      - 'high'     (60 - 79)
      - 'critical' (80 - 100)
    """
    cfg = config or DEFAULT_RISK_CONFIG
    s = max(cfg.score_min, min(cfg.score_max, score))

    if s <= cfg.low_max:
        return "low"
    elif s <= cfg.medium_max:
        return "medium"
    elif s <= cfg.high_max:
        return "high"
    else:
        return "critical"
