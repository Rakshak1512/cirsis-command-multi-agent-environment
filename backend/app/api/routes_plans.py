from typing import List, Optional
from fastapi import APIRouter, HTTPException
from app.models.schemas import ResponsePlan
from app.core.database import db

router = APIRouter(prefix="/plans", tags=["Response Plans"])

@router.get("", response_model=List[ResponsePlan])
def get_plans(incident_id: Optional[str] = None):
    plans = list(db.response_plans.values())
    if incident_id:
        plans = [p for p in plans if p.incident_id == incident_id]
    plans.sort(key=lambda x: x.created_at, reverse=True)
    return plans

@router.get("/{id}", response_model=ResponsePlan)
def get_plan(id: str):
    plan = db.response_plans.get(id)
    if not plan:
        raise HTTPException(status_code=404, detail="Response plan not found.")
    return plan
