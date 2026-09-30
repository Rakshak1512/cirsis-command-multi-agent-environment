import React, { useEffect } from 'react';
import { MyLocationMapCard } from '../map/MyLocationMapCard';
import { useLocationStore } from '../../store/useLocationStore';

interface LocationBarProps {
  className?: string;
  onLocationChange?: (lat: number, lng: number, address: string) => void;
}

/**
 * CRISIS COMMAND — Centralized Real Device Location Experience (Section 18)
 * 
 * Replaces old top status banner with the dedicated real map-first interface:
 * - Real hardware GPS coordinates via browser Geolocation API
 * - OpenStreetMap tiles (https://tile.openstreetmap.org/{z}/{x}/{y}.png)
 * - Leaflet map centering & zoom 18
 * - Blue pulsing marker ("YOU ARE HERE")
 * - Real accuracy radius circle (coords.accuracy in meters)
 * - [ ⌖ MY LOCATION ] floating button
 * - Live reverse-geocoded street via OSM Nominatim
 * - Quality states: ACCURATE (<=50m), APPROXIMATE (50-150m), SEARCHING (>150m)
 * - No fake fallbacks (Malleswaram / Bengaluru), zero IP geolocation
 */
export const LocationBar: React.FC<LocationBarProps> = ({ className = '', onLocationChange }) => {
  const { latitude, longitude, address, status } = useLocationStore();

  useEffect(() => {
    if (latitude !== null && longitude !== null && address) {
      onLocationChange?.(latitude, longitude, address);
    }
  }, [latitude, longitude, address, onLocationChange]);

  return <MyLocationMapCard className={className} />;
};

export default LocationBar;
