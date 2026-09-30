from fastapi import APIRouter
from app.core.database import db
from app.models.schemas import IncidentSeverity, IncidentType, IncidentStatus, ResourceType, ResourceStatus
from app.agents.prediction_agent import prediction_agent

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/prediction")
def get_prediction_forecast():
    return prediction_agent.generate_system_forecast()

@router.get("")
def get_analytics():
    incidents = list(db.incidents.values())
    resources = list(db.resources.values())

    total = len(incidents)
    active = len([i for i in incidents if i.status != IncidentStatus.RESOLVED])
    resolved = len([i for i in incidents if i.status == IncidentStatus.RESOLVED])
    fires = len([i for i in incidents if i.incident_type == IncidentType.FIRE])
    accidents = len([i for i in incidents if i.incident_type == IncidentType.ROAD_ACCIDENT])
    critical = len([i for i in incidents if i.severity == IncidentSeverity.CRITICAL])
    high = len([i for i in incidents if i.severity == IncidentSeverity.HIGH])

    # Replanning counts
    replanning_count = len([p for p in db.response_plans.values() if "V1" not in p.version])
    plan_versions = {
        "Plan V1": len([p for p in db.response_plans.values() if "V1" in p.version]),
        "Plan V2": len([p for p in db.response_plans.values() if "V2" in p.version]),
        "Plan V3+": len([p for p in db.response_plans.values() if any(v in p.version for v in ["V3", "V4", "V5"])])
    }

    # Resource Utilization
    total_fire = len([r for r in resources if r.type == ResourceType.FIRE_TEAM])
    busy_fire = len([r for r in resources if r.type == ResourceType.FIRE_TEAM and r.status != ResourceStatus.AVAILABLE])
    fire_utilization = round((busy_fire / max(total_fire, 1)) * 100, 1)

    total_amb = len([r for r in resources if r.type == ResourceType.AMBULANCE])
    busy_amb = len([r for r in resources if r.type == ResourceType.AMBULANCE and r.status != ResourceStatus.AVAILABLE])
    amb_utilization = round((busy_amb / max(total_amb, 1)) * 100, 1)

    total_hosp = len([r for r in resources if r.type == ResourceType.HOSPITAL])
    busy_hosp = len([r for r in resources if r.type == ResourceType.HOSPITAL and r.status != ResourceStatus.AVAILABLE])
    hosp_utilization = round((busy_hosp / max(total_hosp, 1)) * 100, 1)

    # Average ETA across active assignments
    etas = [a.eta_minutes for a in db.assignments.values() if a.eta_minutes > 0]
    avg_eta = round(sum(etas) / max(len(etas), 1), 1) if etas else 4.8

    # Hourly distribution for charts
    hourly_distribution = [
        {"hour": "06:00", "count": 1},
        {"hour": "08:00", "count": 3},
        {"hour": "10:00", "count": 6},
        {"hour": "12:00", "count": 4},
        {"hour": "14:00", "count": 5},
        {"hour": "16:00", "count": 2},
    ]

    return {
        "total_incidents": total,
        "active_incidents": active,
        "resolved_incidents": resolved,
        "fire_incidents": fires,
        "road_accidents": accidents,
        "critical_incidents": critical,
        "high_incidents": high,
        "average_response_time_min": avg_eta,
        "resource_utilization": {
            "fire_teams": fire_utilization,
            "ambulances": amb_utilization,
            "hospitals": hosp_utilization
        },
        "replanning_events": replanning_count,
        "plan_versions": plan_versions,
        "hourly_distribution": hourly_distribution,
        "audit_log_count": len(db.audit_logs)
    }
