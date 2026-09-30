import urllib.parse
from typing import Dict, Any, Optional
from app.models.schemas import Incident

def format_whatsapp_alert_text(incident: Incident, assigned_units: Optional[str] = None, hospital_name: Optional[str] = None) -> str:
    """Formats an official Crisis Command emergency dispatch alert text suitable for WhatsApp."""
    map_url = f"https://www.openstreetmap.org/?mlat={incident.latitude}&mlon={incident.longitude}#map=16/{incident.latitude}/{incident.longitude}"
    units = assigned_units or "Rapid Response Squad Dispatched"
    hospital = hospital_name or "Regional Trauma Center"

    alert_lines = [
        "🚨 *CRISIS COMMAND ALERT* 🚨",
        "",
        f"📍 *Incident:* {incident.incident_type.value.replace('_', ' ').title()}",
        f"⚠️ *Severity:* {incident.severity.value} ({incident.urgency.value})",
        f"📌 *Location:* {incident.address}",
        f"👥 *People Affected:* {incident.people_affected}",
        f"🚒 *Assigned Responders:* {units}",
        f"🏥 *Designated Hospital:* {hospital}",
        f"🗺️ *Live Map:* {map_url}",
        f"🆔 *Incident ID:* {incident.id}",
        "",
        "⚡ _Automated Response & Logistics Dispatched by Crisis Command AI Platform_"
    ]
    return "\n".join(alert_lines)

def generate_whatsapp_share_url(incident: Incident, phone_number: Optional[str] = None, assigned_units: Optional[str] = None, hospital_name: Optional[str] = None) -> str:
    """Generates an instant click-to-open WhatsApp URL."""
    text = format_whatsapp_alert_text(incident, assigned_units, hospital_name)
    encoded_text = urllib.parse.quote(text)
    if phone_number:
        clean_phone = phone_number.replace("+", "").replace("-", "").replace(" ", "")
        return f"https://api.whatsapp.com/send?phone={clean_phone}&text={encoded_text}"
    return f"https://api.whatsapp.com/send?text={encoded_text}"
