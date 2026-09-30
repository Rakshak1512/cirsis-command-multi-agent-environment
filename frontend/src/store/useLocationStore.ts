import { create } from 'zustand';
import {
  locationService,
  LocationState as ServiceLocationState,
  LocationQualityState,
  PermissionState
} from '../services/locationService';

export type { LocationQualityState, PermissionState };

export interface LocationStoreState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  bestAccuracy: number | null;
  timestamp: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: 'detecting' | 'improving' | 'detected' | 'denied' | 'unavailable' | 'error';
  qualityState: LocationQualityState;
  permission: PermissionState;
  source: string;
  errorMessage: string | null;
  diagnosticTip: string | null;
  lastUpdated: number | null;
  sampleCount: number;
  isWatching: boolean;

  // Actions
  detectLocation: (forceRefresh?: boolean) => Promise<void>;
  refreshLocation: () => Promise<void>;
  checkPermission: () => Promise<PermissionState>;
  startWatching: () => void;
  stopWatching: () => void;
  setManualLocation: (lat: number, lng: number, manualAddress: string) => void;
}

const mapQualityToStatus = (q: LocationQualityState, perm: PermissionState): 'detecting' | 'improving' | 'detected' | 'denied' | 'unavailable' | 'error' => {
  if (perm === 'denied') return 'denied';
  switch (q) {
    case 'ACCURATE':
    case 'APPROXIMATE':
      return 'detected';
    case 'SEARCHING':
      return 'detecting';
    case 'ERROR':
    default:
      return 'unavailable';
  }
};

export const useLocationStore = create<LocationStoreState>((set, get) => {
  const initial = locationService.getState();

  locationService.subscribe((state: ServiceLocationState) => {
    set({
      latitude: state.latitude,
      longitude: state.longitude,
      accuracy: state.accuracy,
      bestAccuracy: state.bestAccuracy,
      timestamp: state.timestamp,
      address: state.address,
      city: state.city,
      state: state.state,
      country: state.country,
      qualityState: state.qualityState,
      status: mapQualityToStatus(state.qualityState, state.permission),
      permission: state.permission,
      isWatching: state.isWatching,
      errorMessage: state.errorMessage,
      diagnosticTip: state.diagnosticTip,
      lastUpdated: state.lastUpdated,
      sampleCount: state.sampleCount,
    });
  });

  return {
    latitude: initial.latitude,
    longitude: initial.longitude,
    accuracy: initial.accuracy,
    bestAccuracy: initial.bestAccuracy,
    timestamp: initial.timestamp,
    address: initial.address,
    city: initial.city,
    state: initial.state,
    country: initial.country,
    status: mapQualityToStatus(initial.qualityState, initial.permission),
    qualityState: initial.qualityState,
    permission: initial.permission,
    source: 'Browser Geolocation API',
    errorMessage: initial.errorMessage,
    diagnosticTip: initial.diagnosticTip,
    lastUpdated: initial.lastUpdated,
    sampleCount: initial.sampleCount,
    isWatching: initial.isWatching,

    checkPermission: async () => {
      return locationService.checkPermission();
    },

    detectLocation: async (forceRefresh = false) => {
      await locationService.getCurrentLocation(forceRefresh);
    },

    refreshLocation: async () => {
      await locationService.getCurrentLocation(true);
    },

    startWatching: () => {
      locationService.watchLocation();
    },

    stopWatching: () => {
      locationService.stopWatching();
    },

    setManualLocation: (lat: number, lng: number, manualAddress: string) => {
      set({
        latitude: lat,
        longitude: lng,
        accuracy: 10,
        bestAccuracy: 10,
        address: manualAddress,
        status: 'detected',
        qualityState: 'ACCURATE',
        source: 'Manual Verification',
        errorMessage: null,
        diagnosticTip: null,
        lastUpdated: Date.now(),
      });
    },
  };
});
