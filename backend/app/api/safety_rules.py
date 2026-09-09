from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
import json
import uuid
from pydantic import BaseModel

from app.db.database import get_db
from app.db import models
from app.api.deps import get_current_user, require_roles

router = APIRouter()


class SafetyRuleDTO(BaseModel):
    id: str
    facility_id: str
    name: str
    description: Optional[str] = None
    behaviour_type: str
    threshold_config_json: Optional[str] = None
    risk_level: str
    enabled: bool

    class Config:
        from_attributes = True


class SafetyRuleToggleRequest(BaseModel):
    enabled: bool


@router.get("/safety-rules", response_model=List[SafetyRuleDTO])
def get_safety_rules(
    facility_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    target_facility_id = facility_id or current_user.facility_id or "FAC-001"
    rules = db.query(models.SafetyRule).filter(models.SafetyRule.facility_id == target_facility_id).all()
    return rules


@router.put("/safety-rules/{id}/toggle", response_model=SafetyRuleDTO)
def toggle_safety_rule(
    id: str,
    payload: SafetyRuleToggleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["ADMIN", "SUPERVISOR"]))
):
    query = db.query(models.SafetyRule).filter(models.SafetyRule.id == id)
    if current_user.facility_id and current_user.role != "ADMIN":
        query = query.filter(models.SafetyRule.facility_id == current_user.facility_id)
    rule = query.first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Safety rule '{id}' not found in authorized facility")

    rule.enabled = payload.enabled
    rule.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(rule)

    # Log audit entry
    try:
        db.add(models.AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12]}",
            organization_id=current_user.organization_id or "ORG-001",
            user_id=current_user.id,
            action="SAFETY_RULE_TOGGLED",
            entity_type="SAFETY_RULE",
            entity_id=rule.id,
            metadata_json=json.dumps({"enabled": rule.enabled, "rule_name": rule.name}),
            created_at=datetime.datetime.utcnow()
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[SafetyRules] Audit log warning: {e}")

    return rule
