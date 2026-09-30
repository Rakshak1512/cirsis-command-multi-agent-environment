import json
import re
from typing import Dict, Any, Optional
from app.models.schemas import IncidentType, IncidentSeverity, IncidentUrgency, IncidentAssessment
from app.core.config import settings

def assess_general_incident(
    incident_type: IncidentType,
    description: str,
    people_affected: int,
    source_type: str = "citizen_report",
    source_confidence: float = 0.95
) -> IncidentAssessment:
    """
    Incident Assessment Agent:
    Uses Google Gemini API if configured with structured reasoning,
    with an advanced rule-based deterministic fallback for offline/demo reliability.
    """
    # 1. Check for Gemini API Key
    if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY.strip()) > 5:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            prompt = f"""
You are an expert Emergency Operations AI Assessment Agent. Analyze the following reported incident and respond STRICTLY in JSON.

Incident Type: {incident_type.value}
Description: "{description}"
Reported People Affected: {people_affected}
Source Type: {source_type} (Confidence: {source_confidence})

Return ONLY this JSON schema:
{{
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "urgency": "CRITICAL" | "URGENT" | "MODERATE" | "ROUTINE",
  "people_at_risk": <integer>,
  "vehicles_involved": <integer>,
  "burn_hazard": <boolean>,
  "extrication_needed": <boolean>,
  "required_resources": ["fire_team", "ambulance", "hospital"],
  "reasoning": [<string>, ...],
  "source_conflict": <boolean>,
  "conflict_notes": <string or null>,
  "confidence_score": <float between 0.8 and 1.0>
}}
"""
            response = model.generate_content(prompt)
            text = response.text.strip()
            # Clean markdown codeblocks if any
            text = re.sub(r"^```json\s*", "", text)
            text = re.sub(r"```$", "", text).strip()
            data = json.loads(text)

            return IncidentAssessment(
                incident_type=incident_type,
                severity=IncidentSeverity(data.get("severity", "HIGH")),
                urgency=IncidentUrgency(data.get("urgency", "CRITICAL")),
                people_at_risk=int(data.get("people_at_risk", max(people_affected, 1))),
                vehicles_involved=int(data.get("vehicles_involved", 0)),
                burn_hazard=bool(data.get("burn_hazard", False)),
                extrication_needed=bool(data.get("extrication_needed", False)),
                required_resources=data.get("required_resources", ["fire_team", "ambulance", "hospital"]),
                reasoning=data.get("reasoning", ["AI analyzed incident payload via Gemini API."]),
                source_conflict=bool(data.get("source_conflict", False)),
                conflict_notes=data.get("conflict_notes"),
                confidence_score=float(data.get("confidence_score", 0.95))
            )
        except Exception as e:
            # Fallback smoothly to deterministic assessment
            pass

    # 2. Advanced Deterministic Assessment Engine (Section 52 & 53)
    desc_lower = description.lower()
    
    # Assess Fire
    if incident_type == IncidentType.FIRE:
        is_chemical_or_commercial = any(k in desc_lower for k in ["chemical", "factory", "warehouse", "mall", "complex", "gas", "explosion", "flames billowing"])
        is_trapped = any(k in desc_lower for k in ["trapped", "casualties", "screaming", "blocked", "terrace"])
        
        if is_chemical_or_commercial or is_trapped or people_affected >= 5:
            severity = IncidentSeverity.HIGH
            urgency = IncidentUrgency.CRITICAL
            req_resources = ["fire_team", "ambulance", "hospital"]
            burn_hazard = True
            reasons = [
                "Commercial or high-risk structure identified with active fire progression",
                f"Multiple individuals at risk (reported: {people_affected}) requiring coordinated medical evacuation",
                "Thermal burn hazard detected; Level-1 or Burn center pre-notification activated"
            ]
        elif any(k in desc_lower for k in ["brush", "yard", "pallets", "trash", "minor", "small", "smoke"]):
            severity = IncidentSeverity.LOW
            urgency = IncidentUrgency.MODERATE
            req_resources = ["fire_team"]
            burn_hazard = False
            reasons = [
                "Localized outdoor/yard fire with low structural threat",
                "Single fire suppression unit sufficient"
            ]
        else:
            severity = IncidentSeverity.MEDIUM
            urgency = IncidentUrgency.URGENT
            req_resources = ["fire_team", "ambulance"]
            burn_hazard = True
            reasons = [
                "Residential/urban fire with moderate structural risk",
                "Precautionary ambulance assignment for smoke inhalation"
            ]

        return IncidentAssessment(
            incident_type=IncidentType.FIRE,
            severity=severity,
            urgency=urgency,
            people_at_risk=max(people_affected, 1 if severity != IncidentSeverity.LOW else 0),
            vehicles_involved=0,
            burn_hazard=burn_hazard,
            extrication_needed=False,
            required_resources=req_resources,
            reasoning=reasons,
            source_conflict=False,
            conflict_notes=None,
            confidence_score=0.96
        )

    # Assess Road Accident
    else:
        is_multi_vehicle = any(k in desc_lower for k in ["multi-vehicle", "bus", "truck", "pileup", "rollover", "multiple cars"])
        is_extrication = any(k in desc_lower for k in ["trapped", "pinned", "crushed", "jaws", "extrication", "hydraulic"])
        
        vehicles = 3 if is_multi_vehicle else (2 if "two" in desc_lower or "collision" in desc_lower else 1)
        
        if is_extrication or is_multi_vehicle or people_affected >= 4:
            severity = IncidentSeverity.HIGH
            urgency = IncidentUrgency.CRITICAL
            req_resources = ["ambulance", "hospital", "fire_team"] # Fire team needed for heavy hydraulic extrication
            reasons = [
                f"High-impact collision with {vehicles} vehicles involved and significant kinetic trauma",
                "Entrapment/crush hazard necessitates hydraulic rescue equipment",
                "Immediate trauma resuscitation and surgical bay reservation required"
            ]
            extrication = True
        elif any(k in desc_lower for k in ["fender", "minor", "rear-end", "slow", "scratch", "bumper"]):
            severity = IncidentSeverity.LOW
            urgency = IncidentUrgency.ROUTINE
            req_resources = ["ambulance"]
            reasons = [
                "Low-velocity impact with minimal structural vehicle intrusion",
                "Basic life support / triage evaluation recommended"
            ]
            extrication = False
        else:
            severity = IncidentSeverity.MEDIUM
            urgency = IncidentUrgency.URGENT
            req_resources = ["ambulance", "hospital"]
            reasons = [
                "Moderate roadway collision with patient stabilization required",
                "Direct transit to closest available emergency center"
            ]
            extrication = False

        return IncidentAssessment(
            incident_type=IncidentType.ROAD_ACCIDENT,
            severity=severity,
            urgency=urgency,
            people_at_risk=max(people_affected, 1),
            vehicles_involved=vehicles,
            burn_hazard=False,
            extrication_needed=extrication,
            required_resources=req_resources,
            reasoning=reasons,
            source_conflict=False,
            conflict_notes=None,
            confidence_score=0.95
        )
