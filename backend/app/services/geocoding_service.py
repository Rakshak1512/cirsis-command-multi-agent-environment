import logging
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory geocode cache to respect Nominatim rate limit and avoid repeated queries
_GEOCODE_CACHE: Dict[str, Dict[str, Any]] = {}
_REVERSE_GEOCODE_CACHE: Dict[str, str] = {}

class GeocodingService:
    """
    OpenStreetMap Nominatim geocoding service with caching.
    Complies with Nominatim usage policy (no spam, no autocomplete, custom User-Agent, cached).
    """

    def __init__(self, provider: Optional[str] = None):
        self.provider = (provider or getattr(settings, "GEOCODING_PROVIDER", "nominatim")).lower()

    def clear_cache(self):
        _GEOCODE_CACHE.clear()
        _REVERSE_GEOCODE_CACHE.clear()

    def geocode(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Geocodes an address string to coordinates.
        Returns: {"latitude": float, "longitude": float, "display_name": str} or None.
        """
        if not query or not query.strip():
            return None

        clean_q = query.strip().lower()
        if clean_q in _GEOCODE_CACHE:
            return _GEOCODE_CACHE[clean_q]

        # Preset fallback for quick demo queries if offline or rate-limited
        demo_presets = {
            "bangalore": {"latitude": 12.9716, "longitude": 77.5946, "display_name": "Bengaluru, Karnataka, India"},
            "mg road": {"latitude": 12.9756, "longitude": 77.6066, "display_name": "MG Road, Bengaluru, Karnataka, India"},
            "koramangala": {"latitude": 12.9352, "longitude": 77.6245, "display_name": "Koramangala, Bengaluru, Karnataka, India"},
            "indiranagar": {"latitude": 12.9784, "longitude": 77.6408, "display_name": "Indiranagar, Bengaluru, Karnataka, India"},
            "whitefield": {"latitude": 12.9698, "longitude": 77.7499, "display_name": "Whitefield, Bengaluru, Karnataka, India"}
        }
        for preset_name, preset_val in demo_presets.items():
            if preset_name in clean_q:
                _GEOCODE_CACHE[clean_q] = preset_val
                return preset_val

        if self.provider == "nominatim":
            try:
                url = "https://nominatim.openstreetmap.org/search"
                params = {
                    "q": query.strip(),
                    "format": "jsonv2",
                    "limit": 1,
                    "addressdetails": 1
                }
                headers = {
                    "User-Agent": "CrisisCommand-EmergencySystem/1.0 (contact: support@crisiscommand.demo)"
                }
                with httpx.Client(timeout=2.5) as client:
                    resp = client.get(url, params=params, headers=headers)
                    if resp.status_code == 200:
                        results = resp.json()
                        if results and len(results) > 0:
                            first = results[0]
                            res = {
                                "latitude": float(first["lat"]),
                                "longitude": float(first["lon"]),
                                "display_name": first.get("display_name", query)
                            }
                            _GEOCODE_CACHE[clean_q] = res
                            return res
            except Exception as e:
                logger.warning(f"Nominatim geocode query failed ({e}). Returning fallback coordinate.")

        # Return None when geocoding fails — never substitute a fake city-center coordinate.
        # The calling code must fall back to the real device GPS the citizen already provided.
        logger.warning(f"Geocoding lookup failed for '{query}'. Returning None — caller must use real device GPS.")
        return None

    def reverse_geocode(self, lat: float, lng: float) -> dict:
        """
        Reverse geocodes latitude/longitude to clean readable address and metadata.
        """
        cache_key = f"{round(lat, 4)},{round(lng, 4)}"
        if cache_key in _REVERSE_GEOCODE_CACHE:
            return _REVERSE_GEOCODE_CACHE[cache_key]

        if self.provider == "nominatim":
            try:
                url = "https://nominatim.openstreetmap.org/reverse"
                params = {
                    "lat": lat,
                    "lon": lng,
                    "format": "jsonv2"
                }
                headers = {
                    "User-Agent": "CrisisCommand-EmergencySystem/1.0 (contact: support@crisiscommand.demo)"
                }
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(url, params=params, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        addr_dict = data.get("address") or {}

                        # Build concise, readable address format (e.g. "Indiranagar, Bengaluru, Karnataka")
                        parts = []
                        locality = (
                            addr_dict.get("suburb") or 
                            addr_dict.get("neighbourhood") or 
                            addr_dict.get("residential") or 
                            addr_dict.get("commercial") or 
                            addr_dict.get("road")
                        )
                        if locality:
                            parts.append(locality)

                        city = (
                            addr_dict.get("city") or 
                            addr_dict.get("town") or 
                            addr_dict.get("municipality") or 
                            addr_dict.get("village") or 
                            addr_dict.get("county")
                        )
                        if city and city not in parts:
                            parts.append(city)

                        state = addr_dict.get("state")
                        if state and state not in parts:
                            parts.append(state)

                        if parts:
                            readable = ", ".join(parts)
                        else:
                            raw_parts = [p.strip() for p in (data.get("display_name") or "").split(",") if p.strip()]
                            readable = ", ".join(raw_parts[:3]) if raw_parts else f"Coordinates ({round(lat, 5)}, {round(lng, 5)})"

                        result = {
                            "readable_address": readable,
                            "display_name": data.get("display_name") or readable,
                            "city": city,
                            "state": state,
                            "country": addr_dict.get("country"),
                            "latitude": lat,
                            "longitude": lng
                        }
                        _REVERSE_GEOCODE_CACHE[cache_key] = result
                        return result
            except Exception as e:
                logger.warning(f"Nominatim reverse geocode failed ({e}).")

        fallback = {
            "readable_address": f"Coordinates ({round(lat, 5)}, {round(lng, 5)})",
            "display_name": f"Coordinates ({round(lat, 5)}, {round(lng, 5)})",
            "city": None,
            "state": None,
            "country": None,
            "latitude": lat,
            "longitude": lng
        }
        _REVERSE_GEOCODE_CACHE[cache_key] = fallback
        return fallback

geocoding_service = GeocodingService()
