from typing import List, Optional
from pydantic import BaseModel

class SummaryMetrics(BaseModel):
    totalEvents: int
    criticalEvents: int
    highRiskEvents: int
    mediumRiskEvents: int
    lowRiskEvents: int

class AnalyticsSummaryResponse(BaseModel):
    summary: SummaryMetrics

class BehaviourCount(BaseModel):
    name: str
    value: int
    avg_score: Optional[float] = None

class RiskDistribution(BaseModel):
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
