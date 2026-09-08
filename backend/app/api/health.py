from fastapi import APIRouter
from typing import Dict

router = APIRouter(tags=["Health"])

@router.get("/health")
def get_health() -> Dict[str, str]:
    return {
        "status": "healthy",
        "service": "warehouse-intelligence-platform",
        "version": "1.0.0"
    }
