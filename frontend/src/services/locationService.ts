/**
 * CRISIS COMMAND — Centralized Real Device Location Service (Rebuilt)
 * 
 * Strict Architecture:
 * 1. REAL DEVICE -> Browser Geolocation API -> GPS/Wi-Fi hardware
 * 2. High-Accuracy multi-sample watchPosition
 * 3. Keeps bestPosition (lowest reported accuracy)
 * 4. Quality States:
 *      accuracy <= 50m               -> ACCURATE
 *      accuracy > 50m && <= 150m     -> APPROXIMATE
 *      accuracy > 150m               -> SEARCHING / IMPROVING
 *      error / denied / unavailable  -> ERROR
 * 5. OpenStreetMap Nominatim ONLY for reverse-geocoding real coordinates
 * 6. NO IP geolocation, NO Malleswaram/Bengaluru hardcoded fallbacks
 */

import { api } from './api';

export type LocationQualityState = 'PINPOINT' | 'ACCURATE' | 'APPROXIMATE' | 'SEARCHING' | 'ERROR';
export type PermissionState = 'granted' | 'prompt' | 'denied';

export function getPrecisionPercent(accuracy: number | null): number {
  if (accuracy === null || accuracy <= 0) return 0;
  if (accuracy <= 10) return 100; // <= 10m is 100% precision
  if (accuracy <= 20) return 95;
  if (accuracy <= 30) return 90;
  if (accuracy <= 50) return 85;
  if (accuracy <= 100) return 75;
  if (accuracy <= 200) return 60;
  if (accuracy <= 500) return 40;
  return Math.max(5, Math.round((1000 / accuracy) * 20));
}

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null; // raw browser-reported horizontal accuracy in meters
  bestAccuracy: number | null;
  precisionPercent: number; // 0 to 100%
  heading: number | null;
  speed: number | null;
  timestamp: number | null; // epoch ms
  permission: PermissionState;
  qualityState: LocationQualityState;
  isWatching: boolean;
  errorMessage: string | null;
  diagnosticTip: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lastUpdated: number | null;
  sampleCount: number;
}

export type LocationListener = (state: LocationState) => void;

class LocationService {
  private state: LocationState = {
    latitude: null,
    longitude: null,
    accuracy: null,
    bestAccuracy: null,
    precisionPercent: 0,
    heading: null,
    speed: null,
    timestamp: null,
    permission: 'prompt',
    qualityState: 'SEARCHING',
    isWatching: false,
    errorMessage: null,
    diagnosticTip: null,
    address: null,
    city: null,
    state: null,
    country: null,
    lastUpdated: null,
    sampleCount: 0,
  };

  private listeners: Set<LocationListener> = new Set();
  private watchId: number | null = null;
  private bestPosition: GeolocationPosition | null = null;
  private timeoutTimer: any = null;
  private reverseGeocodeCache = new Map<string, { address: string; city: string | null; state: string | null; country: string | null }>();
  private lastGeocodeRequestTime = 0;
  private isAcquiring = false;

  constructor() {
    this.checkPermission();
  }

  public getState(): LocationState {
    return { ...this.state };
  }

  public subscribe(listener: LocationListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[LocationService] Listener error:', err);
      }
    });
  }

  private setState(updates: Partial<LocationState>) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  public async checkPermission(): Promise<PermissionState> {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        const queryStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        const perm = queryStatus.state as PermissionState;
        this.setState({ permission: perm });

        queryStatus.onchange = () => {
          const updated = queryStatus.state as PermissionState;
          this.setState({ permission: updated });
          if (updated === 'granted') {
            this.getCurrentLocation(true);
          } else if (updated === 'denied') {
            this.stopWatching();
            this.setState({
              qualityState: 'ERROR',
              latitude: null,
              longitude: null,
              accuracy: null,
              bestAccuracy: null,
              address: null,
              errorMessage: 'Location permission was denied. Please allow location access in your browser settings.',
              diagnosticTip: 'Click the tune/lock icon in your browser URL bar to allow Location access.',
            });
          }
        };
        return perm;
      } catch {
        return 'prompt';
      }
    }
    return 'prompt';
  }

  /**
   * Request fresh real device location with high accuracy
   * Never uses hardcoded Malleswaram/Bengaluru fallbacks or IP location
   */
  public async getCurrentLocation(forceRefresh = false): Promise<LocationState> {
    if (this.isAcquiring && !forceRefresh) {
      return this.getState();
    }

    this.isAcquiring = true;

    if (forceRefresh) {
      this.stopWatching();
      this.bestPosition = null;
      if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
      this.setState({
        latitude: null,
        longitude: null,
        accuracy: null,
        bestAccuracy: null,
        qualityState: 'SEARCHING',
        isWatching: false,
        address: null,
        errorMessage: null,
        diagnosticTip: null,
        sampleCount: 0,
      });
    } else {
      this.setState({
        qualityState: this.state.latitude ? this.state.qualityState : 'SEARCHING',
        errorMessage: null,
        diagnosticTip: null,
      });
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.isAcquiring = false;
      this.setState({
        qualityState: 'ERROR',
        errorMessage: 'Geolocation is not supported by this browser.',
      });
      return this.getState();
    }

    console.log('[LOCATION] Request started');

    const perm = await this.checkPermission();
    if (perm === 'denied') {
      this.isAcquiring = false;
      this.setState({
        qualityState: 'ERROR',
        errorMessage: 'Location permission denied. Enable location permission in your browser/device settings.',
        diagnosticTip: 'Click the padlock or site settings icon in the address bar and enable Location access.',
      });
      return this.getState();
    }

    return new Promise<LocationState>((resolve) => {
      let resolved = false;

      // Timeout fallback: if no position arrives within 20s
      this.timeoutTimer = setTimeout(async () => {
        if (!resolved) {
          if (this.state.latitude !== null && this.state.longitude !== null) {
            // Settle with best position seen so far
            const acc = this.state.accuracy || 500;
            const qState: LocationQualityState = acc <= 50 ? 'ACCURATE' : acc <= 150 ? 'APPROXIMATE' : 'APPROXIMATE';
            console.log(`[LOCATION] Acquisition timeout. Settling with best available fix: ±${Math.round(acc)}m (${qState})`);
            this.setState({
              qualityState: qState,
              diagnosticTip: acc > 150
                ? `Approximate fix (±${Math.round(acc)}m). For precise GPS, test on a mobile phone outdoors.`
                : null,
            });
            await this.resolveReverseGeocode(this.state.latitude, this.state.longitude, true);
          } else {
            console.warn('[LOCATION] Location request timed out without coordinates.');
            this.setState({
              qualityState: 'ERROR',
              errorMessage: 'Your device could not provide a current location in time. Please check device GPS and retry.',
            });
          }
          resolved = true;
          this.isAcquiring = false;
          resolve(this.getState());
        }
      }, 20000);

      const options: PositionOptions = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 60000,
      };

      const handlePosition = async (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy, heading, speed } = position.coords;
        const posTimestamp = position.timestamp || Date.now();
        const count = this.state.sampleCount + 1;
        const precisionPercent = getPrecisionPercent(accuracy);

        console.log(`[LOCATION UPDATE]\nlatitude: ${latitude}\nlongitude: ${longitude}\naccuracy: ${accuracy}m (${precisionPercent}%)\ntimestamp: ${new Date(posTimestamp).toISOString()}`);

        const prevLat = this.state.latitude;
        const prevLng = this.state.longitude;
        const distMoved = (prevLat !== null && prevLng !== null) ? this.calculateMeters(prevLat, prevLng, latitude, longitude) : 0;

        // Maintain best hardware fix seen
        if (!this.bestPosition || accuracy < this.bestPosition.coords.accuracy) {
          this.bestPosition = position;
        }

        // Live Tracking Decision:
        // 1. Initial coordinates lock
        // 2. Accuracy improved over current state
        // 3. User moved >= 3m (sensitive real-time tracking)
        // 4. Periodic refresh every 3s if accuracy is reasonable
        let shouldUpdate = false;
        if (prevLat === null || prevLng === null) {
          shouldUpdate = true;
        } else if (accuracy < (this.state.accuracy ?? Infinity)) {
          shouldUpdate = true;
        } else if (distMoved >= 3 && accuracy <= 120) {
          shouldUpdate = true;
        } else if (Date.now() - (this.state.lastUpdated || 0) > 3000 && accuracy <= 80) {
          shouldUpdate = true;
        }

        // Quality States with strict 10m pinpoint lock (100% precision)
        let quality: LocationQualityState = 'SEARCHING';
        if (accuracy <= 10) {
          quality = 'PINPOINT'; // Exact 10m target met
          console.log('[LOCATION] Pinpoint 100% accuracy GPS fix acquired (<= 10m)');
        } else if (accuracy <= 50) {
          quality = 'ACCURATE';
          console.log('[LOCATION] High accuracy position accepted');
        } else if (accuracy <= 150) {
          quality = 'APPROXIMATE';
          console.log('[LOCATION] Acceptable accuracy');
        } else {
          quality = 'SEARCHING';
          console.log(`[LOCATION] Coarse accuracy (±${Math.round(accuracy)}m) — continuing to watch for better fix`);
        }

        if (shouldUpdate) {
          const bestAcc = this.bestPosition ? this.bestPosition.coords.accuracy : accuracy;

          this.setState({
            latitude,
            longitude,
            accuracy: Math.round(accuracy * 10) / 10,
            bestAccuracy: Math.round(bestAcc * 10) / 10,
            precisionPercent,
            heading: heading ?? null,
            speed: speed ?? null,
            timestamp: posTimestamp,
            permission: 'granted',
            qualityState: quality,
            isWatching: true,
            errorMessage: null,
            diagnosticTip: quality === 'PINPOINT'
              ? 'Target 10m precision locked (100% GPS Accuracy).'
              : quality === 'SEARCHING'
              ? `Current fix accuracy is ±${Math.round(accuracy)}m. Watching for satellites...`
              : null,
            lastUpdated: Date.now(),
            sampleCount: count,
          });

          // Reverse geocode real coordinates (throttled & cached)
          this.resolveReverseGeocode(latitude, longitude, false);

          if (!resolved) {
            resolved = true;
            this.isAcquiring = false;
            if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
            resolve(this.getState());
          }
        }
      };

      const handleError = (error: GeolocationPositionError) => {
        console.warn('[LOCATION] Geolocation error:', error.message);
        this.isAcquiring = false;
        if (this.timeoutTimer) clearTimeout(this.timeoutTimer);

        let errorMessage = 'Failed to acquire device location.';
        let diagnosticTip = 'Ensure device location / GPS is enabled.';

        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location permission denied. Enable location permission in your browser/device settings.';
          diagnosticTip = 'Click the lock icon in the address bar and select "Allow" for Location.';
          this.setState({ permission: 'denied' });
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Your device could not provide a current location.';
          diagnosticTip = 'If on a desktop without GPS, ensure Wi-Fi is enabled for network triangulation, or test on a mobile phone.';
        } else if (error.code === error.TIMEOUT) {
          errorMessage = 'Location request timed out. Please check device GPS.';
          diagnosticTip = 'Try testing outdoors or near a window for better GPS satellite line-of-sight.';
        }

        this.setState({
          qualityState: 'ERROR',
          errorMessage,
          diagnosticTip,
          latitude: null,
          longitude: null,
          accuracy: null,
          bestAccuracy: null,
          address: null,
          isWatching: false,
        });

        if (!resolved) {
          resolved = true;
          resolve(this.getState());
        }
      };

      // Watch continuously for live updates (Section 2 & 14)
      if (this.watchId !== null) {
        navigator.geolocation.clearWatch(this.watchId);
      }
      this.watchId = navigator.geolocation.watchPosition(handlePosition, handleError, options);
      this.setState({ isWatching: true });

      // Immediate one-shot acquisition
      navigator.geolocation.getCurrentPosition(handlePosition, handleError, options);
    });
  }

  public watchLocation(): void {
    this.getCurrentLocation(false);
  }

  public stopWatching(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.setState({ isWatching: false });
    this.isAcquiring = false;
  }

  /**
   * Reverse geocode coordinates using OSM Nominatim ONLY (Section 8)
   * Converts real latitude + longitude into street/area address.
   */
  private async resolveReverseGeocode(lat: number, lng: number, forceRefresh = false) {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (!forceRefresh && this.reverseGeocodeCache.has(cacheKey)) {
      const cached = this.reverseGeocodeCache.get(cacheKey)!;
      this.setState({
        address: cached.address,
        city: cached.city,
        state: cached.state,
        country: cached.country,
      });
      return;
    }

    const now = Date.now();
    if (now - this.lastGeocodeRequestTime < 1000) {
      await new Promise((r) => setTimeout(r, 1000 - (now - this.lastGeocodeRequestTime)));
    }
    this.lastGeocodeRequestTime = Date.now();

    try {
      const res: any = await api.reverseGeocode(lat, lng);
      if (res) {
        const address = res.readable_address || res.address || `Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        const entry = {
          address,
          city: res.city || null,
          state: res.state || null,
          country: res.country || null,
        };
        this.reverseGeocodeCache.set(cacheKey, entry);
        this.setState({
          address: entry.address,
          city: entry.city,
          state: entry.state,
          country: entry.country,
        });
      }
    } catch (e) {
      console.warn('[LocationService] Reverse geocode lookup fallback:', e);
      const fallback = `Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      this.setState({ address: fallback });
    }
  }

  private calculateMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const locationService = new LocationService();
