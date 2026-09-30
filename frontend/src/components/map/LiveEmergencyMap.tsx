import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Compass } from 'lucide-react';
import { Incident, Resource } from '../../types';
import { generateRouteCoordinates } from '../../utils/mapUtils';

export interface CurrentLocationPin {
  latitude: number;
  longitude: number;
  label?: string;
  accuracy?: number;
}

interface LiveEmergencyMapProps {
  incidents: Incident[];
  resources: Resource[];
  selectedIncident?: Incident | null;
  currentLocation?: CurrentLocationPin | null;
  onSelectIncident?: (incident: Incident) => void;
  height?: string;
  zoom?: number;
  center?: [number, number];
}

// Map Recentering Controller to smoothly pan when targets change without reloading the map
const MapViewController: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center[0], center[1], zoom, map]);
  return null;
};

// Custom DivIcons with emergency pulse effect
const createCustomMarker = (color: string, label: string, isPulsing: boolean = false) => {
  return L.divIcon({
    className: 'custom-emergency-icon',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
        ${isPulsing ? `<div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background-color: ${color}; opacity: 0.45; animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
        <div style="position: relative; width: 26px; height: 26px; border-radius: 50%; background-color: ${color}; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: black; font-weight: bold; font-size: 12px; box-shadow: 0 0 12px ${color};">
          ${label}
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
};

// Dedicated GPS Location Pin Icon
const createCurrentLocationIcon = () => {
  return L.divIcon({
    className: 'current-location-icon',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
        <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: #06b6d4; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background-color: #0891b2; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; box-shadow: 0 0 15px #06b6d4;">
          📍
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

const getIncidentColor = (severity: string) => {
  switch (severity) {
    case 'CRITICAL': return '#ff334b'; // Red
    case 'HIGH': return '#f97316';     // Orange
    case 'MEDIUM': return '#eab308';   // Yellow
    default: return '#10b981';         // Green
  }
};

const getResourceColor = (type: string) => {
  switch (type) {
    case 'ambulance': return '#38bdf8'; // Sky Blue
    case 'fire_team': return '#ef4444'; // Red
    case 'hospital': return '#10b981';  // Emerald Green
    default: return '#a855f7';
  }
};

export const LiveEmergencyMap: React.FC<LiveEmergencyMapProps> = ({
  incidents,
  resources,
  selectedIncident,
  currentLocation,
  onSelectIncident,
  height = '480px',
  zoom = 13,
  center,
}) => {
  // Determine dynamic map center (Section 14: Never default to Bengaluru coordinates)
  const hasLockedLocation = !!(center || selectedIncident || currentLocation);
  const defaultCenterLat = selectedIncident?.latitude || currentLocation?.latitude || 20.5937;
  const defaultCenterLng = selectedIncident?.longitude || currentLocation?.longitude || 78.9629;
  const activeCenter: [number, number] = center || [defaultCenterLat, defaultCenterLng];

  // Build active routes (Resource → Incident, and Incident → Hospital)
  const activeRoutes: {
    id: string;
    from: [number, number];
    to: [number, number];
    coords: [number, number][];
    color: string;
    name: string;
    dashArray?: string;
  }[] = [];

  if (selectedIncident && selectedIncident.plans && selectedIncident.plans.length > 0) {
    const activePlan =
      selectedIncident.plans.find((p) => p.status === 'ACTIVE') ||
      selectedIncident.plans[selectedIncident.plans.length - 1];

    if (activePlan) {
      let assignedHospital: Resource | undefined = undefined;

      activePlan.assignments.forEach((asg) => {
        const res = resources.find((r) => r.id === asg.resource_id);
        if (res) {
          if (res.type === 'hospital') {
            assignedHospital = res;
          }

          // Resource → Incident route
          const coords = generateRouteCoordinates(
            res.latitude,
            res.longitude,
            selectedIncident.latitude,
            selectedIncident.longitude,
            10
          ) as [number, number][];

          activeRoutes.push({
            id: `route-${res.id}-${selectedIncident.id}`,
            from: [res.latitude, res.longitude],
            to: [selectedIncident.latitude, selectedIncident.longitude],
            coords,
            color: getResourceColor(res.type),
            name: `${res.name} → Incident (ETA: ${asg.eta_minutes || 4}m)`,
            dashArray: '8, 8',
          });
        }
      });

      // Incident → Hospital corridor
      if (assignedHospital) {
        const hosp = assignedHospital as Resource;
        const hospCoords = generateRouteCoordinates(
          selectedIncident.latitude,
          selectedIncident.longitude,
          hosp.latitude,
          hosp.longitude,
          10
        ) as [number, number][];

        activeRoutes.push({
          id: `hosp-corridor-${selectedIncident.id}-${hosp.id}`,
          from: [selectedIncident.latitude, selectedIncident.longitude],
          to: [hosp.latitude, hosp.longitude],
          coords: hospCoords,
          color: '#10b981',
          name: `Incident → ${hosp.name} (Emergency Trauma Corridor)`,
          dashArray: '4, 6',
        });
      }
    }
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl" style={{ height }}>
      {/* Map Header Status Overlay */}
      <div className="absolute top-3 left-3 z-[400] flex items-center space-x-2 bg-[#050811]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-cyan-500/30 text-xs font-mono text-cyan-300 shadow-glow">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        <span>OPENSTREETMAP LIVE GRID • {incidents.filter((i) => i.status !== 'RESOLVED').length} ACTIVE ALERTS</span>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-6 left-3 z-[400] bg-[#050811]/90 backdrop-blur-md p-3 rounded-xl border border-cyan-500/30 text-[10px] font-mono text-slate-300 space-y-1.5 shadow-lg pointer-events-auto">
        <div className="font-bold text-cyan-400 mb-1 flex items-center space-x-1.5">
          <span>OPERATIONAL LEGEND</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#ff334b] inline-block shadow-glow-red" />
          <span>Fire / Accident Alert</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" />
          <span>Fire Team (Available/Dispatched)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#38bdf8] inline-block" />
          <span>Ambulance (Available/En Route)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#10b981] inline-block" />
          <span>Hospital Trauma Center</span>
        </div>
        {currentLocation && (
          <div className="flex items-center space-x-2 pt-1 border-t border-slate-800">
            <span className="text-xs">📍</span>
            <span className="text-cyan-300 font-bold">Current Location</span>
          </div>
        )}
      </div>

      {/* Always Visible Mandatory OpenStreetMap Attribution Banner */}
      <div className="absolute bottom-1 right-2 z-[400] bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-800 pointer-events-auto">
        &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">OpenStreetMap</a> contributors
      </div>

      {/* Section 14: Finding location overlay before real coordinates are locked */}
      {!hasLockedLocation && (
        <div className="absolute inset-0 z-[450] bg-[#050811]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow-glow">
            <Compass className="w-6 h-6 animate-spin" />
          </div>
          <div className="font-mono text-sm font-bold text-white tracking-wider">FINDING YOUR LOCATION...</div>
          <div className="font-mono text-xs text-slate-400 max-w-sm">
            Acquiring real device GPS coordinates. OpenStreetMap will center immediately once positioning fix is locked.
          </div>
        </div>
      )}

      <MapContainer
        center={activeCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%' }}
      >
        <MapViewController center={activeCenter} zoom={zoom} />

        {/* Standard OpenStreetMap Tile Layer as strictly required */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* 📍 Your Location Marker & Accuracy Circle */}
        {currentLocation && (
          <>
            {currentLocation.accuracy && currentLocation.accuracy > 0 && (
              <Circle
                center={[currentLocation.latitude, currentLocation.longitude]}
                radius={currentLocation.accuracy}
                pathOptions={{
                  color: '#06b6d4',
                  fillColor: '#06b6d4',
                  fillOpacity: 0.12,
                  weight: 1.5,
                  dashArray: '4, 6',
                }}
              />
            )}
            <Marker
              position={[currentLocation.latitude, currentLocation.longitude]}
              icon={createCurrentLocationIcon()}
            >
              <Popup>
                <div className="p-1.5 space-y-1 font-mono text-slate-900">
                  <div className="font-bold text-xs text-cyan-700 flex items-center space-x-1">
                    <span>📍</span>
                    <span>{currentLocation.label || 'Your Location'}</span>
                  </div>
                  <div className="text-[11px] text-slate-700">
                    Lat: {currentLocation.latitude.toFixed(5)}, Lng: {currentLocation.longitude.toFixed(5)}
                  </div>
                  {currentLocation.accuracy && (
                    <div className="text-[10px] text-cyan-700 font-bold">
                      GPS Accuracy: ±{Math.round(currentLocation.accuracy)}m
                    </div>
                  )}
                  <div className="text-[10px] text-emerald-600 font-bold">
                    Device GPS Active • Live Location
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Incidents Markers */}
        {incidents.map((inc) => {
          const isCritical = inc.severity === 'CRITICAL' || inc.severity === 'HIGH';
          const icon = createCustomMarker(
            getIncidentColor(inc.severity),
            inc.incident_type === 'fire' ? '🔥' : '💥',
            isCritical
          );

          return (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectIncident && onSelectIncident(inc),
              }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-slate-900">
                  <div className="font-bold text-xs text-rose-700 flex items-center justify-between">
                    <span>{inc.title}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-bold">
                      {inc.severity}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-700">
                    Type: <span className="font-bold capitalize">{inc.incident_type.replace('_', ' ')}</span> • Status: <span className="font-bold">{inc.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">{inc.address}</div>
                  <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200">
                    Casualties / At Risk: <span className="font-bold text-slate-800">{inc.people_affected}</span>
                  </div>
                  <div className="text-[10px] font-mono text-cyan-800">
                    Plan: {inc.current_plan_version || 'PLAN V1'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Fire Teams & Ambulances & Hospitals */}
        {resources.map((res) => {
          const iconLabel = res.type === 'ambulance' ? '🚑' : res.type === 'fire_team' ? '🚒' : '🏥';
          const isDispatched = res.status === 'DISPATCHED' || res.status === 'BUSY';
          const icon = createCustomMarker(getResourceColor(res.type), iconLabel, isDispatched);

          return (
            <Marker
              key={res.id}
              position={[res.latitude, res.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="p-1.5 space-y-1 text-slate-900">
                  <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>{res.name}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded font-mono font-bold ${
                      res.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {res.status}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-cyan-800 uppercase font-semibold">
                    {res.type.replace('_', ' ')}
                  </div>
                  <div className="text-[11px] text-slate-600">{res.address}</div>
                  <div className="text-[10px] font-mono text-slate-700">
                    Coordinates: {res.latitude.toFixed(4)}, {res.longitude.toFixed(4)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-700">
                    Capacity: {res.available_units}/{res.capacity} units ready
                  </div>
                  {res.specialization && res.specialization.length > 0 && (
                    <div className="text-[10px] font-mono text-slate-500">
                      Spec: {res.specialization.join(', ')}
                    </div>
                  )}
                  {res.current_assignment || res.current_incident_id ? (
                    <div className="text-[10px] font-mono text-purple-700 font-bold pt-1 border-t border-slate-200">
                      Assignment: {res.current_assignment || `Assigned to ${res.current_incident_id}`}
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-emerald-700 font-bold pt-1 border-t border-slate-200">
                      Assignment: Standby / Ready
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Active Dispatch Routes */}
        {activeRoutes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.coords}
            pathOptions={{
              color: route.color,
              weight: 4,
              dashArray: route.dashArray || '8, 8',
              opacity: 0.9,
            }}
          >
            <Popup>
              <div className="p-1 text-xs font-mono text-slate-900 font-bold">
                {route.name}
              </div>
            </Popup>
          </Polyline>
        ))}
      </MapContainer>
    </div>
  );
};
