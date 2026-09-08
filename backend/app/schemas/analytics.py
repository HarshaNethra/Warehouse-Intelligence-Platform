from pydantic import BaseModel
from typing import List, Optional

class AnalyticsSummary(BaseModel):
    totalEvents: int
    criticalEvents: int
    highRiskEvents: int
    mediumRiskEvents: int
    lowRiskEvents: int
    preventionIndex: float = 78.0
    activeIncidents: int = 0
    resolvedIncidents: int = 0
    repeatBehaviourPct: float = 18.0

class AnalyticsSummaryResponse(BaseModel):
    summary: AnalyticsSummary

class BehaviourMetric(BaseModel):
    name: str
    value: int
    avg_score: Optional[float] = None

class RiskMetric(BaseModel):
    risk_level: str
    count: int
    avg_score: Optional[float] = None

class TimelinePoint(BaseModel):
    timestamp: float
    event_id: str
    behaviour: str
    risk_score: float
    risk_level: str
    bay_id: Optional[str] = None
