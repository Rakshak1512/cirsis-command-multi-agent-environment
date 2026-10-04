import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Compass, RotateCw, Navigation, AlertTriangle, ShieldCheck, Crosshair, MapPin } from 'lucide-react';
import { useLocationStore } from '../../store/useLocationStore';
import { LocationDebugPanel } from '../common/LocationDebugPanel';

// Dedicated Controller that centers only when explicitly requested (Section 14: no fighting user drag)
const MapCenterController: React.FC<{
  target: [number, number] | null;
  triggerId: number;
  zoom?: number;
}> = ({ target, triggerId, zoom = 18 }) => {
  const map = useMap();
  const lastTriggerRef = useRef<number>(-1);

  useEffect(() => {
    if (target && !isNaN(target[0]) && !isNaN(target[1])) {
      if (lastTriggerRef.current !== triggerId) {
        lastTriggerRef.current = triggerId;
        map.setView(target, zoom, { animate: true });
      }
    }
  }, [target, triggerId, zoom, map]);

  return null;
};

// Blue "YOU ARE HERE" DivIcon with real-time pulsing beacon
const createMyLocationIcon = () => {
  return L.divIcon({
    className: 'my-location-beacon-icon',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background-color: #0284c7; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 22px; height: 22px; border-radius: 50%; background-color: #0284c7; border: 3px solid #ffffff; box-shadow: 0 0 16px rgba(2, 132, 199, 0.9);">
          <div style="position: absolute; top: 3px; left: 3px; width: 10px; height: 10px; border-radius: 50%; background-color: #ffffff;"></div>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

export const MyLocationMapCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const {
    latitude,
    longitude,
    accuracy,
    precisionPercent,
    speed,
    heading,
    qualityState,
    permission,
    address,
    errorMessage,
    diagnosticTip,
    detectLocation,
    refreshLocation,
  } = useLocationStore();

  const [centerTrigger, setCenterTrigger] = useState(0);
  const [hasFirstCentered, setHasFirstCentered] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Periodically refresh the "Updated X ago" label
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  // Request location on mount
  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  // First lock auto-center
  useEffect(() => {
    if (latitude !== null && longitude !== null && !hasFirstCentered) {
      setHasFirstCentered(true);
      setCenterTrigger((prev) => prev + 1);
    }
  }, [latitude, longitude, hasFirstCentered]);

  // Section 6: [ ⌖ MY LOCATION ] button action
  const handleMyLocationClick = async () => {
    setIsRefreshing(true);
    await detectLocation(true);
    setIsRefreshing(false);
    const state = useLocationStore.getState();
    if (state.latitude !== null && state.longitude !== null) {
      setCenterTrigger((prev) => prev + 1);
    }
  };

  // Section 15: [ ↻ REFRESH LOCATION ] button action
  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    await refreshLocation();
    setIsRefreshing(false);
    const state = useLocationStore.getState();
    if (state.latitude !== null && state.longitude !== null) {
      setCenterTrigger((prev) => prev + 1);
    }
  };

  const hasLocation = latitude !== null && longitude !== null;

  return (
    <div className={`w-full glass-panel rounded-3xl border border-cyan-500/30 overflow-hidden shadow-2xl space-y-4 p-5 sm:p-6 bg-slate-950/70 backdrop-blur-xl ${className}`}>
      {/* Header: Title + Quality State Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Navigation className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold font-display text-white tracking-wide">
              MY CURRENT LOCATION
            </h2>
            <p className="text-[11px] font-mono text-slate-400">
              Live hardware GPS &bull; 10m High-Precision Tracking &bull; OpenStreetMap
            </p>
          </div>
        </div>

        {/* Quality State & Accuracy Badges */}
        <div>
          {qualityState === 'PINPOINT' && (
            <span className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-400/80 flex items-center space-x-1.5 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>100% PINPOINT GPS (±{accuracy ? Math.round(accuracy) : 0}m)</span>
            </span>
          )}
          {qualityState === 'ACCURATE' && (
            <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1.5 shadow-glow-emerald">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>HIGH ACCURACY GPS (±{accuracy ? Math.round(accuracy) : 0}m &bull; {precisionPercent}%)</span>
            </span>
          )}
          {qualityState === 'APPROXIMATE' && (
            <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>APPROXIMATE (±{accuracy ? Math.round(accuracy) : 0}m &bull; {precisionPercent}%)</span>
            </span>
          )}
          {qualityState === 'SEARCHING' && (
            <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>TARGETING 10m FIX... {accuracy ? `(±${Math.round(accuracy)}m • ${precisionPercent}%)` : ''}</span>
            </span>
          )}
          {qualityState === 'ERROR' && (
            <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{permission === 'denied' ? 'PERMISSION DENIED' : 'GPS UNAVAILABLE'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Section 5: Actual Map UI (Large visible area) */}
      <div className="relative w-full h-[360px] sm:h-[400px] rounded-2xl overflow-hidden border border-cyan-500/30 shadow-inner">
        {/* Floating [ ⌖ MY LOCATION ] Map Control Button (Section 6) */}
        <button
          type="button"
          onClick={handleMyLocationClick}
          disabled={isRefreshing}
          className="absolute top-4 right-4 z-[400] px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 hover:text-white border border-cyan-500/40 font-mono text-xs font-bold shadow-2xl backdrop-blur-md flex items-center space-x-1.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          title="Center on my current GPS position"
        >
          <Crosshair className={`w-4 h-4 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>⌖ MY LOCATION</span>
        </button>

        {/* Section 14: Overlay before location is ready */}
        {!hasLocation && qualityState !== 'ERROR' && (
          <div className="absolute inset-0 z-[450] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3 pointer-events-none">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow-glow">
              <Compass className="w-7 h-7 animate-spin" />
            </div>
            <div className="font-mono text-sm font-bold text-white tracking-wider">
              ACQUIRING REAL DEVICE GPS...
            </div>
            <p className="font-mono text-xs text-slate-400 max-w-sm">
              Waiting for browser Geolocation API to return hardware coordinates. Map will center directly on your position with high precision.
            </p>
          </div>
        )}

        {/* Permission Denied / Error Overlay */}
        {qualityState === 'ERROR' && (
          <div className="absolute inset-0 z-[450] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="font-mono text-sm font-bold text-white tracking-wider">
              {permission === 'denied' ? 'LOCATION PERMISSION BLOCKED' : 'COULD NOT OBTAIN LOCATION'}
            </div>
            <p className="font-mono text-xs text-slate-400 max-w-md">
              {errorMessage || 'Your device could not provide a current location. Enable location permissions in your browser or device settings.'}
            </p>
            {diagnosticTip && (
              <p className="font-mono text-[11px] text-amber-300 max-w-md bg-amber-950/40 p-2 rounded-xl border border-amber-500/30">
                {diagnosticTip}
              </p>
            )}
            <button
              type="button"
              onClick={handleRefreshClick}
              className="mt-2 px-5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400 font-mono text-xs font-bold transition-all shadow-glow hover:scale-105"
            >
              ↻ RETRY ACQUISITION
            </button>
          </div>
        )}

        {/* Leaflet + OpenStreetMap Container */}
        <MapContainer
          center={hasLocation ? [latitude!, longitude!] : [20.5937, 78.9629]}
          zoom={hasLocation ? 18 : 5}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Centering controller (only pans when centerTrigger changes, never fighting manual drag) */}
          <MapCenterController
            target={hasLocation ? [latitude!, longitude!] : null}
            triggerId={centerTrigger}
            zoom={18}
          />

          {/* Standard OpenStreetMap Tile Layer as strictly required (Section 1) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* Real Device Location Marker & Accuracy Circle (Section 5) */}
          {hasLocation && (
            <>
              {accuracy !== null && accuracy > 0 && (
                <Circle
                  center={[latitude!, longitude!]}
                  radius={accuracy}
                  pathOptions={{
                    color: '#0284c7',
                    fillColor: '#0284c7',
                    fillOpacity: 0.14,
                    weight: 2,
                    dashArray: '5, 5',
                  }}
                />
              )}

              <Marker position={[latitude!, longitude!]} icon={createMyLocationIcon()}>
                <Popup>
                  <div className="p-1 space-y-1 font-mono text-slate-900">
                    <div className="font-bold text-xs text-sky-700 flex items-center space-x-1">
                      <span>🔵</span>
                      <span>YOU ARE HERE</span>
                    </div>
                    <div className="text-[11px] text-slate-700 font-semibold">
                      {latitude!.toFixed(6)}°N, {longitude!.toFixed(6)}°E
                    </div>
                    <div className="text-[10px] text-sky-800 font-bold">
                      Reported Accuracy: &plusmn;{accuracy ? Math.round(accuracy) : 0}m
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {address || 'Reverse-geocoding street...'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>

      {/* Bottom Information & Control Bar (Section 5 & 18) */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 min-w-[260px] flex-1">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              {address || (hasLocation ? 'Resolving street address...' : 'Waiting for GPS fix...')}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-x-3">
            {hasLocation ? (
              <>
                <span className="text-cyan-300 font-semibold">
                  {latitude!.toFixed(6)}°, {longitude!.toFixed(6)}°
                </span>
                <span>&bull;</span>
                <span className={accuracy && accuracy <= 10 ? 'text-emerald-300 font-bold' : accuracy && accuracy <= 50 ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                  Accuracy: &plusmn;{accuracy ? Math.round(accuracy * 10) / 10 : 0}m
                </span>
                <span>&bull;</span>
                <span className={precisionPercent >= 95 ? 'text-emerald-400 font-bold' : 'text-cyan-300'}>
                  Precision: {precisionPercent}%
                </span>
                <span>&bull;</span>
                <span className="text-slate-400 text-[10px]">
                  Target: &le;10m
                </span>
                {speed !== null && speed > 0 && (
                  <>
                    <span>&bull;</span>
                    <span className="text-cyan-400 font-mono">Speed: {(speed * 3.6).toFixed(1)} km/h</span>
                  </>
                )}
                <span>&bull;</span>
                <span className="text-slate-500">Live GPS tracking active</span>
              </>
            ) : (
              <span className="text-slate-500">Coordinates pending hardware lock</span>
            )}
          </div>
        </div>

        {/* Section 18 Action Buttons: [ ⌖ MY LOCATION ] & [ ↻ REFRESH LOCATION ] */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleMyLocationClick}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/60 font-mono text-xs font-bold transition-all shadow-glow hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>⌖ MY LOCATION</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-mono text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center space-x-1.5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>↻ REFRESH LOCATION</span>
          </button>
        </div>
      </div>

      {/* Section 13: Location Debug Panel (DEV only) */}
      <LocationDebugPanel />
    </div>
  );
};
