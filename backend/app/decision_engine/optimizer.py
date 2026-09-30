import math
from typing import List, Dict, Tuple, Optional, Any
from app.models.schemas import Resource, ResourceType, ResourceStatus, IncidentSeverity
from app.services.routing_service import routing_service

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates deterministic distance between two geographic coordinates in kilometers."""
    return routing_service.calculate_distance(lat1, lon1, lat2, lon2)

def calculate_eta_minutes(distance_km: float, resource_type: Any, is_emergency: bool = True) -> float:
    """Calculates realistic emergency vehicle ETA using the configurable routing service."""
    type_str = resource_type.value if hasattr(resource_type, "value") else str(resource_type)
    return routing_service.calculate_eta(distance_km, type_str, is_emergency)

def generate_route_coordinates(start_lat: float, start_lng: float, end_lat: float, end_lng: float, steps: int = 12) -> List[List[float]]:
    """Generates OpenStreetMap-compatible road coordinates between start and destination."""
    res = routing_service.calculate_route(start_lat, start_lng, end_lat, end_lng)
    return res.get("coordinates", [])

def score_resource_candidate(
    resource: Resource,
    target_lat: float,
    target_lng: float,
    severity: IncidentSeverity,
    required_specializations: Optional[List[str]] = None
) -> Tuple[float, float, float]:
    """
    Deterministic Multi-Criteria Resource Scoring Engine.
    Returns: (composite_score, distance_km, eta_minutes)
    Lower score = better match.
    """
    dist = calculate_haversine_distance(resource.latitude, resource.longitude, target_lat, target_lng)
    eta = calculate_eta_minutes(dist, resource.type, is_emergency=True)

    # Base score is ETA in minutes
    score = eta * 1.5

    # Status penalty
    if resource.status != ResourceStatus.AVAILABLE:
        score += 1000.0 # Huge penalty if not available

    # Specialization bonus
    if required_specializations and resource.specialization:
        matched = set(required_specializations).intersection(set(resource.specialization))
        score -= len(matched) * 3.0

    # Capacity bonus for hospitals/stations
    if resource.available_units > 0:
        score -= min(resource.available_units * 0.2, 2.0)
    else:
        score += 500.0

    return round(score, 2), dist, eta

def find_best_resource(
    candidate_resources: List[Resource],
    target_lat: float,
    target_lng: float,
    resource_type: ResourceType,
    severity: IncidentSeverity,
    required_specializations: Optional[List[str]] = None,
    exclude_ids: Optional[List[str]] = None
) -> Optional[Dict[str, Any]]:
    """
    Part 10, 11, 12, 13: Deterministic Resource Allocation Pipeline:
    1. Query eligible resources by type
    2. Filter out unavailable, committed, or excluded resources
    3. Validate geographical coordinates
    4. Validate capacity (available_units > 0)
    5. Validate specialization (prioritizing or strictly matching required capabilities)
    6. Calculate distance, route, and ETA deterministically
    7. Rank valid candidates by composite score
    """
    exclude = set(exclude_ids or [])
    filtered = [
        r for r in candidate_resources 
        if r.type == resource_type 
        and r.id not in exclude 
        and r.status == ResourceStatus.AVAILABLE
        and (r.available_units is None or r.available_units > 0)
        and r.latitude is not None and r.longitude is not None
        and -90.0 <= r.latitude <= 90.0 and -180.0 <= r.longitude <= 180.0
        and not (abs(r.latitude) < 0.0001 and abs(r.longitude) < 0.0001)
    ]

    if not filtered:
        return None

    # If specific specializations are required (e.g. Burn Unit, Level-1 Trauma, Rescue),
    # prioritize resources that have matching specializations
    if required_specializations:
        req_set = set(s.lower() for s in required_specializations)
        matching_spec = [
            r for r in filtered
            if r.specialization and any(spec.lower() in req_set or any(s in spec.lower() for s in req_set) for spec in r.specialization)
        ]
        # If any matching resources exist, strictly select from them
        if matching_spec:
            filtered = matching_spec

    scored = []
    for r in filtered:
        score, dist, eta = score_resource_candidate(r, target_lat, target_lng, severity, required_specializations)
        scored.append({
            "resource": r,
            "score": score,
            "distance_km": dist,
            "eta_minutes": eta
        })

    # Sort ascending by composite score
    scored.sort(key=lambda x: x["score"])
    best = scored[0]

    # Alternative resources for fallback plan
    alternatives = []
    for item in scored[1:3]:
        alternatives.append({
            "resource_id": item["resource"].id,
            "resource_name": item["resource"].name,
            "distance_km": item["distance_km"],
            "eta_minutes": item["eta_minutes"]
        })

    return {
        "selected": best["resource"],
        "distance_km": best["distance_km"],
        "eta_minutes": best["eta_minutes"],
        "alternatives": alternatives
    }
