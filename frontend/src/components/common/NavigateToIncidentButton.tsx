/**
 * CRISIS COMMAND — Navigate To Incident Button
 *
 * Reusable component used by both Hospital and Fire Team dashboards.
 *
 * FLOW:
 * 1. User clicks [🧭 NAVIGATE TO INCIDENT]
 * 2. Fresh GPS acquired from device (maximumAge: 0)
 * 3. Real incident coordinates retrieved from backend incident object
 * 4. Google Maps directions URL built:
 *    Origin     = Responder current GPS
 *    Destination = Incident coordinates (immutable)
 * 5. Google Maps opened externally in new tab / mobile app
 *
 * CRITICAL RULE:
 * - Responder GPS  → ORIGIN
 * - Incident GPS   → DESTINATION
 * - NEVER confuse these two
 */

import React, { useState } from 'react';
import { Navigation, Loader2, AlertTriangle, MapPin, ExternalLink, RotateCw } from 'lucide-react';
import {
  acquireResponderLocation,
  buildGoogleMapsUrl,
  buildGoogleMapsDestOnlyUrl,
  openGoogleMapsExternal,
  isValidCoordinate,
  NavigationState,
} from '../../services/navigationService';
import type { Incident } from '../../types';

interface Props {
  /** The incident to navigate to — provides the immutable destination coordinates */
  incident: Incident;
  /** Label displayed on the button (optional) */
  label?: string;
  /** CSS classes to apply to the button wrapper */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

export const NavigateToIncidentButton: React.FC<Props> = ({
  incident,
  label = 'NAVIGATE TO INCIDENT',
  className = '',
  size = 'md',
}) => {
  const [navState, setNavState] = useState<NavigationState>({
    step: 'idle',
    errorMessage: null,
    errorCode: null,
    responderLocation: null,
  });

  const incidentLat = incident.latitude;
  const incidentLng = incident.longitude;

  // Destination must always be valid incident coordinates
  const destinationValid = isValidCoordinate(incidentLat, incidentLng);

  const handleNavigate = () => {
    if (!destinationValid) {
      setNavState({
        step: 'error',
        errorMessage: 'Incident location coordinates are not available. Cannot open navigation.',
        errorCode: null,
        responderLocation: null,
      });
      return;
    }

    setNavState({ step: 'requesting_location', errorMessage: null, errorCode: null, responderLocation: null });

    acquireResponderLocation(
      (responderLoc) => {
        // GPS acquired — build and open Google Maps
        setNavState({
          step: 'opening_maps',
          errorMessage: null,
          errorCode: null,
          responderLocation: responderLoc,
        });

        const url = buildGoogleMapsUrl(
          responderLoc.latitude,
          responderLoc.longitude,
          incidentLat,
          incidentLng
        );
        openGoogleMapsExternal(url);

        // Reset to idle after short delay
        setTimeout(() => {
          setNavState((prev) => ({ ...prev, step: 'idle' }));
        }, 3000);
      },
      (code, message) => {
        // GPS failed — show error with fallback option
        setNavState({
          step: 'error',
          errorMessage: message,
          errorCode: code,
          responderLocation: null,
        });
      }
    );
  };

  const handleFallbackOpenMaps = () => {
    // Fallback: open Google Maps with only the destination (user's device GPS will be used by Maps)
    const url = buildGoogleMapsDestOnlyUrl(incidentLat, incidentLng);
    openGoogleMapsExternal(url);
    setNavState({ step: 'idle', errorMessage: null, errorCode: null, responderLocation: null });
  };

  const handleRetry = () => {
    setNavState({ step: 'idle', errorMessage: null, errorCode: null, responderLocation: null });
    handleNavigate();
  };

  const isLoading = navState.step === 'requesting_location' || navState.step === 'opening_maps';
  const isPermissionDenied = navState.errorCode === 1;

  const btnPaddingClass = size === 'sm' ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-xs';

  return (
    <div className="space-y-2">
      {/* Main Navigate Button */}
      <button
        type="button"
        onClick={handleNavigate}
        disabled={isLoading || !destinationValid}
        className={`
          ${btnPaddingClass}
          rounded-xl font-mono font-bold transition-all
          flex items-center space-x-2 group
          ${isLoading
            ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/40 cursor-wait'
            : 'bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white border border-cyan-500/60 shadow-glow hover:scale-[1.02] active:scale-95'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title={
          !destinationValid
            ? 'Incident location not available'
            : 'Get current GPS location and open Google Maps navigation to incident'
        }
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {navState.step === 'requesting_location'
                ? 'Getting your location...'
                : 'Opening Google Maps...'}
            </span>
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4 group-hover:animate-pulse" />
            <span>🧭 {label}</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </>
        )}
      </button>

      {/* Location Status on success */}
      {navState.step === 'opening_maps' && navState.responderLocation && (
        <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono flex items-center space-x-1.5">
          <MapPin className="w-3 h-3 shrink-0" />
          <span>
            Your GPS: {navState.responderLocation.latitude.toFixed(5)},{' '}
            {navState.responderLocation.longitude.toFixed(5)}{' '}
            (±{navState.responderLocation.accuracy}m) → Navigating to incident
          </span>
        </div>
      )}

      {/* Error Panel */}
      {navState.step === 'error' && navState.errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 space-y-2">
          <div className="flex items-start space-x-2 text-rose-300 text-[11px] font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{navState.errorMessage}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Retry with GPS */}
            <button
              type="button"
              onClick={handleRetry}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-[10px] font-mono font-bold hover:border-cyan-400 hover:text-cyan-300 flex items-center space-x-1.5 transition-all"
            >
              <RotateCw className="w-3 h-3" />
              <span>TRY AGAIN</span>
            </button>

            {/* Fallback: open Google Maps with destination only */}
            {destinationValid && (
              <button
                type="button"
                onClick={handleFallbackOpenMaps}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold hover:bg-cyan-900/60 flex items-center space-x-1.5 transition-all"
                title="Google Maps will use your device's available location"
              >
                <Navigation className="w-3 h-3" />
                <span>OPEN MAPS (DESTINATION ONLY)</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Permission hint */}
          {isPermissionDenied && (
            <div className="text-[10px] font-mono text-amber-400 border-t border-rose-500/20 pt-2">
              💡 To allow location: Click the 🔒 padlock in the browser address bar → Site settings → Location → Allow
            </div>
          )}
        </div>
      )}
    </div>
  );
};
