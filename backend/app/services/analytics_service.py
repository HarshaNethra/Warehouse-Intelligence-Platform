from typing import Dict, Any, List
from app.db import repository

def get_summary() -> Dict[str, Any]:
    return repository.get_analytics_summary()

def get_behaviours() -> List[Dict[str, Any]]:
    return repository.get_behaviour_analytics()

def get_risk_breakdown() -> List[Dict[str, Any]]:
    return repository.get_risk_analytics()

def get_timeline() -> List[Dict[str, Any]]:
    return repository.get_timeline_analytics()
