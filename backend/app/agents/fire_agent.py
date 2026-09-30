from app.models.schemas import IncidentAssessment, IncidentSeverity, IncidentUrgency, IncidentType
from typing import Dict, Any

class FireAssessmentAgent:
    """Specialized Fire & Rescue domain agent."""
    def analyze(self, description: str, people_affected: int, source_type: str = "citizen_report") -> Dict[str, Any]:
        desc_lower = description.lower()
        is_structure = any(w in desc_lower for w in ["building", "apartment", "mall", "complex", "house", "shop", "floor"])
        is_hazmat = any(w in desc_lower for w in ["chemical", "gas", "petrol", "toxic", "leak", "factory", "fumes"])
        is_rapid_spread = any(w in desc_lower for w in ["spreading", "explosions", "massive", "billowing", "engulfed", "uncontrolled"])

        needed_equipment = ["Standard Pumper"]
        if is_structure:
            needed_equipment.append("Ladder Truck")
        if is_hazmat:
            needed_equipment.append("Hazmat Foam Cannon")

        specializations = ["structural_fire"]
        if is_hazmat:
            specializations.append("hazmat")

        return {
            "is_structural": is_structure,
            "is_hazmat": is_hazmat,
            "is_rapid_spread": is_rapid_spread,
            "needed_equipment": needed_equipment,
            "required_specializations": specializations,
            "water_tenders_required": 2 if is_rapid_spread else 1,
            "hospital_burn_unit_required": True if (is_hazmat or people_affected >= 3) else False
        }
