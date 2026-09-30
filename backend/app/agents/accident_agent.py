from typing import Dict, Any

class AccidentAssessmentAgent:
    """Specialized Road Accident domain agent."""
    def analyze(self, description: str, people_affected: int, source_type: str = "citizen_report") -> Dict[str, Any]:
        desc_lower = description.lower()
        is_rollover = any(w in desc_lower for w in ["rollover", "overturned", "flipped", "upside down"])
        is_entrapment = any(w in desc_lower for w in ["pinned", "trapped", "stuck", "jaws", "crushed", "hydraulic", "cannot open door"])
        is_highway = any(w in desc_lower for w in ["highway", "expressway", "freeway", "high speed", "outer ring"])

        return {
            "is_rollover": is_rollover,
            "is_entrapment": is_entrapment,
            "is_high_speed": is_highway,
            "extrication_gear_required": is_entrapment or is_rollover,
            "requires_fire_rescue_team": is_entrapment or is_rollover, # Fire team needed for jaws of life / extrication
            "als_ambulance_preferred": True if (is_entrapment or people_affected >= 2 or is_highway) else False,
            "level1_trauma_required": True if (is_entrapment or people_affected >= 3) else False
        }
