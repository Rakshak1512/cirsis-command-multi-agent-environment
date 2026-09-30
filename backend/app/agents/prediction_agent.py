import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.models.schemas import IncidentSeverity, IncidentType, IncidentStatus, ResourceType, ResourceStatus
from app.core.database import db
from app.core.config import settings

class PredictionAgent:
    """
    Prediction Agent:
    Evaluates Current World State (active incidents, resource utilization,
    hospital capacity, weather/structural vectors) and computes:
    - Escalation Risk (%)
    - Resource Demand (units needed over next 30-120 min)
    - Response Delay (projected dispatch & traffic delay in minutes)
    - Hospital Pressure (%)
    - AI Explanation explaining the forecast reasoning.
    """

    def generate_system_forecast(self) -> Dict[str, Any]:
        """Generates comprehensive system-wide emergency response forecast."""
        incidents = list(db.incidents.values())
        resources = list(db.resources.values())

        active_incidents = [i for i in incidents if i.status != IncidentStatus.RESOLVED]
        active_fires = [i for i in active_incidents if i.incident_type == IncidentType.FIRE]
        active_accidents = [i for i in active_incidents if i.incident_type == IncidentType.ROAD_ACCIDENT]
        critical_count = len([i for i in active_incidents if i.severity == IncidentSeverity.CRITICAL])
        high_count = len([i for i in active_incidents if i.severity == IncidentSeverity.HIGH])

        # 1. Escalation Risk calculation (0-100%)
        # Base risk from severity profile and people affected
        total_affected = sum(i.people_affected for i in active_incidents)
        base_risk = 22.0
        if critical_count > 0:
            base_risk += critical_count * 24.0
        if high_count > 0:
            base_risk += high_count * 14.0
        if len(active_fires) > 1:
            base_risk += 12.0 # Fire spread potential
        if total_affected > 8:
            base_risk += 10.0
        escalation_risk = min(max(round(base_risk, 1), 15.0), 94.0)

        # 2. Resource Demand calculation
        # Baseline demand per active incident type
        fire_demand = len(active_fires) * 2 + (critical_count * 1)
        amb_demand = len(active_accidents) * 2 + len(active_fires) * 1 + max(int(total_affected / 3), 1)
        hosp_bed_demand = max(int(total_affected * 0.75), len(active_incidents) * 2)

        # Available counts
        avail_fire = len([r for r in resources if r.type == ResourceType.FIRE_TEAM and r.status == ResourceStatus.AVAILABLE])
        avail_amb = len([r for r in resources if r.type == ResourceType.AMBULANCE and r.status == ResourceStatus.AVAILABLE])
        avail_beds = sum(r.available_units for r in resources if r.type == ResourceType.HOSPITAL)
        total_beds = sum(r.capacity for r in resources if r.type == ResourceType.HOSPITAL)

        fire_shortage = max(0, fire_demand - avail_fire)
        amb_shortage = max(0, amb_demand - avail_amb)

        # 3. Response Delay (min)
        # Baseline average delay 3.5m, increases if units are busy or spread across grid
        busy_units = len([r for r in resources if r.status != ResourceStatus.AVAILABLE])
        total_units = max(len(resources), 1)
        utilization_ratio = busy_units / total_units
        projected_delay = round(3.2 + (utilization_ratio * 4.8) + (critical_count * 0.6), 1)

        # 4. Hospital Pressure (%)
        occupied_beds = total_beds - avail_beds
        hospital_pressure = round((occupied_beds / max(total_beds, 1)) * 100, 1)

        # 5. AI Explanation
        factors = []
        if critical_count > 0:
            factors.append(f"{critical_count} active CRITICAL incident(s) imposing high priority demand")
        if fire_shortage > 0:
            factors.append(f"Projected fire suppression demand ({fire_demand} units) exceeds immediate availability ({avail_fire} units)")
        if amb_shortage > 0:
            factors.append(f"Ambulance fleet operating at high load; {amb_shortage} secondary units queued")
        if hospital_pressure > 60:
            factors.append(f"Regional trauma network saturation at {hospital_pressure}%; diversion protocols active")
        else:
            factors.append(f"Hospital trauma capacity stable with {avail_beds} available beds across 5 centers")

        ai_explanation = (
            f"Prediction Model Forecast: Escalation risk evaluated at {escalation_risk}%. "
            f"Resource demand indicates need for {fire_demand} fire engines and {amb_demand} ALS ambulances. "
            f"Average transit delay estimated at {projected_delay} minutes. "
            + " | ".join(factors)
        )

        return {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "forecast": {
                "escalation_risk": escalation_risk,
                "escalation_level": "CRITICAL" if escalation_risk >= 75 else ("HIGH" if escalation_risk >= 50 else "MODERATE"),
                "resource_demand": {
                    "fire_engines_needed": fire_demand,
                    "ambulances_needed": amb_demand,
                    "hospital_beds_needed": hosp_bed_demand,
                    "fire_shortage_risk": fire_shortage > 0,
                    "ambulance_shortage_risk": amb_shortage > 0
                },
                "response_delay_minutes": projected_delay,
                "hospital_pressure_percent": hospital_pressure,
                "active_incidents_monitored": len(active_incidents),
                "casualties_at_risk": total_affected
            },
            "ai_explanation": ai_explanation,
            "architecture": {
                "step_1": "CURRENT WORLD STATE (Active Incidents, Unit Telemetry, Bed Counts)",
                "step_2": "PREDICTION ENGINE / MATHEMATICAL CAPACITY ANALYSIS",
                "step_3": "PROBABILISTIC FORECAST (Escalation, Demand, Delays, Pressure)",
                "step_4": "MULTI-AGENT AI EXPLANATION & PRE-EMPTIVE REPLAN ADVICE"
            }
        }

prediction_agent = PredictionAgent()
