import os
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db import models
from app.config import settings, AppEnvironment

def load_environment_fixtures(environment: str, db: Session) -> dict:
    """
    Loads deterministic environment-tagged fixture events.
    Fails safely if invoked for PRODUCTION environment.
    """
    env_upper = environment.strip().upper()
    if env_upper == AppEnvironment.PRODUCTION.value:
        raise ValueError("CRITICAL GOVERNANCE VIOLATION: Cannot load synthetic fixtures into PRODUCTION environment!")

    is_demo = (env_upper == AppEnvironment.DEMO.value)
    is_test = (env_upper in [AppEnvironment.TEST.value, "STRESS", "QA"])

    # Sample deterministic fixture events
    behaviours = ["Product Freefall / Drop (carton)", "Rough Handling", "Improper Stacking", "Product Dragged"]
    risks = [("CRITICAL", 92.0), ("HIGH", 75.0), ("MEDIUM", 45.0), ("LOW", 25.0)]

    loaded_events = []
    for i in range(10):
        b_name, (r_level, r_score) = behaviours[i % 4], risks[i % 4]
        evt_id = f"EVT-FIX-{env_upper[:4]}-{i+1:03d}"
        
        evt = db.query(models.Event).filter(models.Event.event_id == evt_id).first()
        if not evt:
            evt = models.Event(
                event_id=evt_id,
                organization_id="ORG-001",
                facility_id="FAC-001" if i % 2 == 0 else "FAC-002",
                video_id="vid-cam01-20231027",
                timestamp=float(i * 5.0),
                camera_id="CAM-01" if i % 2 == 0 else "CAM-05",
                bay_id="Loading Bay 01" if i % 2 == 0 else "Loading Bay 05",
                behaviour=b_name,
                risk_score=r_score,
                risk_level=r_level,
                description=f"Deterministic {env_upper} fixture event #{i+1}",
                reason=f"Generated for {env_upper} environment verification",
                status="UNRESOLVED" if i % 3 != 0 else "RESOLVED",
                provenance_type="DEMO_FIXTURE" if is_demo else ("PERFORMANCE_TEST" if is_test else "DEVELOPMENT_SEED"),
                environment=env_upper,
                is_demo_data=is_demo,
                is_test_data=is_test,
                created_at=datetime.datetime.utcnow()
            )
            db.add(evt)
            loaded_events.append(evt_id)

    db.commit()
    return {"environment": env_upper, "loaded_count": len(loaded_events), "event_ids": loaded_events}

def reset_environment_database(environment: str, db: Session) -> dict:
    """
    Cleans up database tables for TEST/DEMO/DEVELOPMENT environments.
    Strictly forbids operations when target environment is PRODUCTION.
    """
    env_upper = environment.strip().upper()
    if env_upper == AppEnvironment.PRODUCTION.value or settings.ENVIRONMENT == AppEnvironment.PRODUCTION:
        raise RuntimeError("CRITICAL SECURITY VIOLATION: Cannot reset production database!")

    # Delete non-production events and audit logs
    deleted_events = db.query(models.Event).filter(
        (models.Event.environment == env_upper) | 
        (models.Event.is_test_data.is_(True)) | 
        (models.Event.is_demo_data.is_(True)) |
        (models.Event.provenance_type.in_(["PERFORMANCE_TEST", "DEMO_FIXTURE", "UNIT_TEST"]))
    ).delete(synchronize_session=False)

    db.commit()
    return {"environment": env_upper, "deleted_events_count": deleted_events, "status": "RESET_SUCCESSFUL"}
