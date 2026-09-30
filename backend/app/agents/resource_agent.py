from typing import List, Dict, Any, Optional
from app.models.schemas import Resource, ResourceType, IncidentSeverity, IncidentAssessment
from app.decision_engine.optimizer import find_best_resource

class ResourceAllocationAgent:
    """Discovers and matches nearest capable emergency assets."""

    def allocate(
        self,
        candidate_resources: List[Resource],
        latitude: float,
        longitude: float,
        assessment: IncidentAssessment,
        exclude_resource_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        allocated_items = []
        alternatives = []
        unavailable_requirements = []

        exclude_ids = list(exclude_resource_ids or [])

        for req_type_str in assessment.required_resources:
            try:
                res_type = ResourceType(req_type_str)
            except ValueError:
                continue

            # Determine specializations
            req_specs = []
            if res_type == ResourceType.HOSPITAL:
                if assessment.burn_hazard:
                    req_specs.append("Burn Unit")
                if assessment.extrication_needed or assessment.severity in [IncidentSeverity.CRITICAL, IncidentSeverity.HIGH]:
                    req_specs.append("Level-1 Trauma")
            elif res_type == ResourceType.FIRE_TEAM:
                if assessment.extrication_needed:
                    req_specs.append("rescue")

            best_match = find_best_resource(
                candidate_resources=candidate_resources,
                target_lat=latitude,
                target_lng=longitude,
                resource_type=res_type,
                severity=assessment.severity,
                required_specializations=req_specs,
                exclude_ids=exclude_ids
            )

            if best_match:
                resource_obj = best_match["selected"]
                allocated_items.append({
                    "resource": resource_obj,
                    "distance_km": best_match["distance_km"],
                    "eta_minutes": best_match["eta_minutes"]
                })
                # Add to exclude to prevent duplicate multi-role assignment
                exclude_ids.append(resource_obj.id)
                alternatives.extend(best_match["alternatives"])
            else:
                unavailable_requirements.append(req_type_str)

        return {
            "allocated_items": allocated_items,
            "alternatives": alternatives,
            "unmet_needs": unavailable_requirements
        }
