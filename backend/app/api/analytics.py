from fastapi import APIRouter
from typing import List, Dict, Any
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    BehaviourCount,
    RiskDistribution,
    TimelinePoint
)
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_summary():
    summary_data = analytics_service.get_summary()
    return {"summary": summary_data}

@router.get("/behaviours", response_model=List[BehaviourCount])
def get_behaviours():
    return analytics_service.get_behaviours()

@router.get("/risk", response_model=List[RiskDistribution])
def get_risk():
    return analytics_service.get_risk_breakdown()

@router.get("/timeline", response_model=List[TimelinePoint])
def get_timeline():
    return analytics_service.get_timeline()
