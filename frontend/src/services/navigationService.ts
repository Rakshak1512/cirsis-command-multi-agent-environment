/**
 * CRISIS COMMAND — Responder Navigation Service
 *
 * Rules:
 * 1. RESPONDER current GPS  →  Google Maps ORIGIN
 * 2. INCIDENT coordinates   →  Google Maps DESTINATION (immutable source of truth)
 * 3. NEVER use hardcoded, cached, or fake coordinates
 * 4. Always open Google Maps externally (window.open)
 * 5. maximumAge: 0 — fresh GPS every time navigate is clicked
 */

export interface ResponderLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type NavigationStep =
  | 'idle'
  | 'requesting_location'
  | 'location_granted'
  | 'opening_maps'
  | 'error';

export interface NavigationState {
  step: NavigationStep;
  errorMessage: string | null;
  errorCode?: number | null;
  responderLocation: ResponderLocation | null;
}

/**
 * Validates that coordinates are real (non-zero, in range)
 */
export function isValidCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  // Reject (0,0) which is the null-island — never a real incident
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Haversine distance in kilometers between two real coordinates
 */
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Builds a Google Maps directions URL.
 * Origin  = responder current device GPS
 * Destination = incident coordinates (immutable)
 */
export function buildGoogleMapsUrl(
  responderLat: number,
  responderLng: number,
  incidentLat: number,
  incidentLng: number
): string {
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(`${responderLat},${responderLng}`)}` +
    `&destination=${encodeURIComponent(`${incidentLat},${incidentLng}`)}` +
    `&travelmode=driving`
  );
}

/**
 * Builds a Google Maps URL with ONLY the destination (when no responder GPS is available).
 * Google Maps will determine the user's current location itself.
 */
export function buildGoogleMapsDestOnlyUrl(incidentLat: number, incidentLng: number): string {
  return (
    `https://www.google.com/maps/search/?api=1` +
    `&query=${encodeURIComponent(`${incidentLat},${incidentLng}`)}`
  );
}

/**
 * Acquires a fresh, single-shot GPS fix from the device.
 * Uses maximumAge: 0 — never returns a stale cached position.
 * Timeout: 15 seconds per spec.
 */
export function acquireResponderLocation(
  onSuccess: (location: ResponderLocation) => void,
  onError: (code: number, message: string) => void
): void {
  if (!('geolocation' in navigator)) {
    onError(0, 'Geolocation is not supported by this browser or device.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      if (!isValidCoordinate(latitude, longitude)) {
        onError(2, 'Device returned invalid coordinates. Please try again.');
        return;
      }
      onSuccess({
        latitude,
        longitude,
        accuracy: Math.round(accuracy),
        timestamp: Date.now(),
      });
    },
    (error) => {
      let msg = 'Unable to determine your current location.';
      if (error.code === error.PERMISSION_DENIED) {
        msg = 'Location permission denied. Please allow location access in your browser settings.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = 'Your device could not determine its location. Please try again.';
      } else if (error.code === error.TIMEOUT) {
        msg = 'Location detection timed out. Please try again.';
      }
      onError(error.code, msg);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0, // MUST be 0 — no stale cache for emergency navigation
    }
  );
}

/**
 * Opens Google Maps externally using window.open (safe for mobile deep-linking).
 * Never embeds Google Maps in an iframe.
 */
export function openGoogleMapsExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
