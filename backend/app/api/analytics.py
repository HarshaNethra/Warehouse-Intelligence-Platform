from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.db.database import get_db
from app.db import models
from app.api.deps import get_current_user
from app.schemas import analytics as analytics_schema

router = APIRouter()

from app.config import settings, AppEnvironment

def apply_facility_filter(
    query, 
    facility_id: Optional[str] = None, 
    current_user: Optional[models.User] = None, 
    include_fixtures: bool = True
):
    actual_facility = None
    if isinstance(facility_id, str) and facility_id.strip():
        actual_facility = facility_id.strip()
    
    if current_user and current_user.role != "ADMIN" and current_user.facility_id:
        actual_facility = current_user.facility_id

    if actual_facility:
        from sqlalchemy import or_
        query = query.filter(or_(models.Event.facility_id == actual_facility, models.Event.facility_id.is_(None)))

    if not include_fixtures:
        query = query.filter(
            (models.Event.is_test_data.is_(False) | models.Event.is_test_data.is_(None)),
            (models.Event.is_demo_data.is_(False) | models.Event.is_demo_data.is_(None))
        )

    # Data Governance & Environment Contamination Shield
    if settings.ENVIRONMENT == AppEnvironment.PRODUCTION:
        query = query.filter(
            (models.Event.is_test_data.is_(False) | models.Event.is_test_data.is_(None)),
            (models.Event.is_demo_data.is_(False) | models.Event.is_demo_data.is_(None)),
            (models.Event.environment == "PRODUCTION") | (models.Event.environment.is_(None))
        )
    return query

@router.get("/analytics/summary", response_model=analytics_schema.AnalyticsSummaryResponse)
def get_analytics_summary(
    facility_id: Optional[str] = Query(None),
    include_fixtures: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = apply_facility_filter(db.query(models.Event), facility_id, current_user, include_fixtures)
    
    total = query.count()
    critical = query.filter(models.Event.risk_level.ilike("Critical")).count()
    high = query.filter(models.Event.risk_level.ilike("High")).count()
    medium = query.filter(models.Event.risk_level.ilike("Medium")).count()
    low = query.filter(models.Event.risk_level.ilike("Low")).count()

    active = query.filter(models.Event.status.in_(["UNRESOLVED", "OPEN", "ACKNOWLEDGED", "DISPATCHED"])).count()
    resolved = query.filter(models.Event.status == "RESOLVED").count()

    # Dynamic Damage Prevention Index (0.0 to 100.0)
    if total == 0:
        prevention_index = 100.0
    else:
        penalty = (critical * 15) + (high * 8) + (medium * 3) + (low * 1)
        base_score = 100.0 - (penalty / total * 5.0)
        prevention_index = round(max(min(base_score, 100.0), 0.0), 1)

    # Dynamic Repeat Behaviour Percentage
    behaviour_counts = query.with_entities(models.Event.behaviour, func.count(models.Event.event_id)).group_by(models.Event.behaviour).all()
    repeat_events = sum(count - 1 for _, count in behaviour_counts if count > 1)
    repeat_behaviour_pct = round((repeat_events / max(total, 1)) * 100.0, 1) if total > 0 else 0.0

    summary = analytics_schema.AnalyticsSummary(
        totalEvents=total,
        criticalEvents=critical,
        highRiskEvents=high,
        mediumRiskEvents=medium,
        lowRiskEvents=low,
        preventionIndex=prevention_index,
        activeIncidents=active,
        resolvedIncidents=resolved,
        repeatBehaviourPct=repeat_behaviour_pct
    )
    return analytics_schema.AnalyticsSummaryResponse(summary=summary)

@router.get("/analytics/behaviours", response_model=List[analytics_schema.BehaviourMetric])
def get_analytics_behaviours(
    facility_id: Optional[str] = Query(None),
    include_fixtures: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = apply_facility_filter(
        db.query(
            models.Event.behaviour, 
            func.count(models.Event.event_id).label('count'),
            func.avg(models.Event.risk_score).label('avg_score')
        ),
        facility_id,
        current_user,
        include_fixtures
    )
        
    results = query.group_by(models.Event.behaviour).all()

    return [
        analytics_schema.BehaviourMetric(name=r.behaviour, value=r.count, avg_score=r.avg_score)
        for r in results
    ]

@router.get("/analytics/risk", response_model=List[analytics_schema.RiskMetric])
def get_analytics_risk(
    facility_id: Optional[str] = Query(None),
    include_fixtures: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = apply_facility_filter(
        db.query(
            models.Event.risk_level, 
            func.count(models.Event.event_id).label('count'),
            func.avg(models.Event.risk_score).label('avg_score')
        ),
        facility_id,
        current_user,
        include_fixtures
    )

    results = query.group_by(models.Event.risk_level).all()

    return [
        analytics_schema.RiskMetric(risk_level=r.risk_level, count=r.count, avg_score=r.avg_score)
        for r in results
    ]

@router.get("/analytics/timeline", response_model=List[analytics_schema.TimelinePoint])
def get_analytics_timeline(
    facility_id: Optional[str] = Query(None),
    include_fixtures: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = apply_facility_filter(db.query(models.Event), facility_id, current_user, include_fixtures)
    events = query.order_by(models.Event.timestamp.asc()).all()
    
    return [
        analytics_schema.TimelinePoint(
            timestamp=e.timestamp,
            event_id=e.event_id,
            behaviour=e.behaviour,
            risk_score=e.risk_score,
            risk_level=e.risk_level,
            bay_id=e.bay_id
        ) for e in events
    ]
