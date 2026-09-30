import React, { useEffect, useState } from 'react';
import {
  Flame, Car, MapPin, Radio, ShieldCheck, Clock, Share2, Copy,
  ArrowLeft, AlertCircle, CheckCircle2, Navigation, HeartPulse,
  Phone, AlertTriangle, Shield
} from 'lucide-react';
import { useCrisisStore } from '../store/useCrisisStore';
import { Incident, Resource, Assignment } from '../types';
import { LiveEmergencyMap } from '../components/map/LiveEmergencyMap';
import { universalShareService } from '../services/universalShareService';
import { UniversalShareModal } from '../components/common/UniversalShareModal';

interface CitizenIncidentPageProps {
  incidentId: string;
  navigate: (path: string) => void;
}

export const CitizenIncidentPage: React.FC<CitizenIncidentPageProps> = ({ incidentId, navigate }) => {
  const { user, incidents, resources, assignments, notifications, fetchInitialData } = useCrisisStore();
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareModalIncident, setShareModalIncident] = useState<Incident | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Periodically refresh current time to update "Updated X seconds ago" counter
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll/refresh store occasionally if needed
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const incident = incidents.find((i) => i.id === incidentId);

  // Authorization check (Part 22 & Part 39 Test 10)
  // Only the citizen who reported it, or commander/admin may access
  const isAuthorized = () => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    if (role === 'admin' || role === 'commander' || role === 'dispatcher') return true;

    // Session reports check
    let sessionIds: string[] = [];
    try {
      const saved = localStorage.getItem('citizen_reported_ids');
      if (saved) sessionIds = JSON.parse(saved);
    } catch {}

    if (incident) {
      if (incident.reported_by_id === user.id || incident.reported_by_id === user.email) return true;
      if (sessionIds.includes(incident.id)) return true;
      // If incident was created in this browser session without explicit user id
      if (incident.source_type === 'citizen_report' && !incident.reported_by_id) return true;
    }
    return false;
  };

  if (!incident) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold font-mono text-white">INCIDENT NOT FOUND</h2>
        <p className="text-sm font-mono text-slate-400 max-w-md mx-auto">
          The requested emergency incident reference <span className="text-cyan-400">"{incidentId}"</span> does not exist or has expired.
        </p>
        <button
          onClick={() => navigate('/citizen/dashboard')}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-mono text-xs font-bold hover:bg-cyan-500/30 transition-all shadow-glow"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RETURN TO CITIZEN DASHBOARD</span>
        </button>
      </div>
    );
  }

  if (!isAuthorized()) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold font-mono text-white">ACCESS RESTRICTED</h2>
        <p className="text-sm font-mono text-slate-400 max-w-md mx-auto">
          For privacy and operational security, emergency incident details and responder telemetry are restricted to the reporting citizen and authorized dispatch personnel.
        </p>
        <button
          onClick={() => navigate('/citizen/dashboard')}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs font-bold hover:bg-slate-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RETURN TO MY INCIDENTS</span>
        </button>
      </div>
    );
  }

  // Active Plan & Assigned Resources
  const activePlan = incident.plans?.find((p) => p.status === 'ACTIVE') ||
    incident.plans?.[incident.plans.length - 1];

  // Specific assignment lookup
  const planAssignments = activePlan?.assignments || [];
  const fireAssignment = planAssignments.find((a) => a.resource_type === 'fire_team');
  const hospAssignment = planAssignments.find((a) => a.resource_type === 'hospital');
  const ambAssignment = planAssignments.find((a) => a.resource_type === 'ambulance');

  const fireResource = fireAssignment ? resources.find((r) => r.id === fireAssignment.resource_id) : undefined;
  const hospResource = hospAssignment ? resources.find((r) => r.id === hospAssignment.resource_id) : undefined;
  const ambResource = ambAssignment ? resources.find((r) => r.id === ambAssignment.resource_id) : undefined;

  // Stale Location Detection for Responder (Part 21 & Part 37)
  const getLocationFreshness = (resource?: Resource) => {
    if (!resource || !resource.last_location_update) {
      return { isFresh: false, label: 'Location update unavailable', secondsAgo: null };
    }
    const updateTime = new Date(resource.last_location_update).getTime();
    if (isNaN(updateTime)) {
      return { isFresh: false, label: 'Location update unavailable', secondsAgo: null };
    }
    const diffSec = Math.max(0, Math.floor((now - updateTime) / 1000));
    if (diffSec <= 60) {
      return { isFresh: true, label: `Updated ${diffSec === 0 ? 'just now' : `${diffSec} seconds ago`}`, secondsAgo: diffSec };
    } else {
      return { isFresh: false, label: 'Location update unavailable (stale > 60s)', secondsAgo: diffSec };
    }
  };

  const fireLocationStatus = getLocationFreshness(fireResource);

  // Relevant timeline notifications
  const incidentNotifications = notifications
    .filter((n) => n.incident_id === incident.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleCopyLink = async () => {
    const url = window.location.href;
    const ok = await universalShareService.copyUrl(url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/citizen/dashboard')}
          className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO CITIZEN DASHBOARD</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white hover:border-slate-500 transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'LINK COPIED' : 'COPY TRACKING LINK'}</span>
          </button>
          <button
            onClick={() => setShareModalIncident(incident)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>SHARE</span>
          </button>
        </div>
      </div>

      {/* Primary Emergency Header */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold tracking-wider uppercase">LIVE EMERGENCY RESPONSE TRACKING</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-bold">
              REF #{incident.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-tight flex items-center space-x-3">
            <span>{incident.incident_type === 'fire' ? 'FIRE EMERGENCY' : 'ROAD ACCIDENT'}</span>
            <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold uppercase tracking-wider ${
              incident.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              incident.status === 'EN_ROUTE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' :
              'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}>
              {incident.status}
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-mono flex items-center space-x-2">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{incident.address || `GPS: ${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}`}</span>
            {incident.accuracy && <span>(±{Math.round(incident.accuracy)}m accuracy)</span>}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-700 text-right">
            <div className="text-[10px] font-mono text-slate-400 uppercase">SEVERITY / URGENCY</div>
            <div className="text-sm font-mono font-bold text-rose-400">
              {incident.severity || 'HIGH'} • {incident.urgency || 'CRITICAL'}
            </div>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-right">
            <div className="text-[10px] font-mono text-cyan-400 uppercase">AFFECTED PERSONS</div>
            <div className="text-sm font-mono font-bold text-white">
              {incident.people_affected || 1} PERSON{(incident.people_affected || 1) > 1 ? 'S' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* PART 21: RESPONSE TEAM ASSIGNED CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fire Team Box */}
        <div className="glass-panel p-5 rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/20 to-slate-900/60 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono text-red-400 font-bold">
              <Flame className="w-4 h-4 text-red-400" />
              <span>RESPONSE TEAM ASSIGNED</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              fireAssignment?.status === 'ACCEPTED' || fireAssignment?.status === 'EN_ROUTE' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse' :
              fireAssignment?.status === 'ARRIVED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              'bg-slate-800 text-slate-300'
            }`}>
              {fireAssignment?.status || 'ASSIGNED'}
            </span>
          </div>

          <div>
            <div className="text-base font-bold text-white">
              {fireResource?.name || fireAssignment?.resource_name || 'Fire Unit Alpha'}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              Status: <span className="text-cyan-300 font-bold">{fireAssignment?.status === 'EN_ROUTE' ? 'EN ROUTE' : (fireAssignment?.status || 'DISPATCHED')}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-400">Distance: </span>
              <span className="text-white font-bold">
                {fireAssignment?.distance_km ? `${fireAssignment.distance_km.toFixed(1)} km` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">ETA: </span>
              <span className="text-amber-400 font-bold">
                {fireAssignment?.eta_minutes ? `${Math.round(fireAssignment.eta_minutes)} min` : '—'}
              </span>
            </div>
          </div>

          {/* Telemetry Freshness Indicator (Part 21 & Part 37) */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center space-x-2 text-[11px] font-mono">
            <div className={`w-2 h-2 rounded-full ${fireLocationStatus.isFresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            <span className={fireLocationStatus.isFresh ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {fireLocationStatus.label}
            </span>
          </div>
        </div>

        {/* Hospital Box */}
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-slate-900/60 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 font-bold">
              <HeartPulse className="w-4 h-4 text-emerald-400" />
              <span>DESIGNATED HOSPITAL</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              hospAssignment?.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              'bg-slate-800 text-slate-300'
            }`}>
              {hospAssignment?.status === 'ACCEPTED' ? 'PREPARING TRAUMA' : (hospAssignment?.status || 'NOTIFIED')}
            </span>
          </div>

          <div>
            <div className="text-base font-bold text-white">
              {hospResource?.name || hospAssignment?.resource_name || 'Hospital Central Trauma'}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              Registered Facility: <span className="text-emerald-300 font-bold">{hospResource?.address || 'Fixed Medical Center'}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-400">Distance: </span>
              <span className="text-white font-bold">
                {hospAssignment?.distance_km ? `${hospAssignment.distance_km.toFixed(1)} km` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Corridor ETA: </span>
              <span className="text-emerald-400 font-bold">
                {hospAssignment?.eta_minutes ? `${Math.round(hospAssignment.eta_minutes)} min` : '—'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center space-x-2 text-[11px] font-mono text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Emergency Bays Reserved • Trauma Ready</span>
          </div>
        </div>

        {/* Ambulance Box (if assigned) */}
        <div className="glass-panel p-5 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/20 to-slate-900/60 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono text-sky-400 font-bold">
              <Navigation className="w-4 h-4 text-sky-400" />
              <span>ADVANCED LIFE SUPPORT</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {ambAssignment ? (ambAssignment.status || 'DISPATCHED') : 'ON STANDBY'}
            </span>
          </div>

          <div>
            <div className="text-base font-bold text-white">
              {ambResource?.name || ambAssignment?.resource_name || 'Emergency Medical Unit'}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">
              Capability: <span className="text-sky-300 font-bold">ALS Paramedic / Burn Transit</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-slate-400">Distance: </span>
              <span className="text-white font-bold">
                {ambAssignment?.distance_km ? `${ambAssignment.distance_km.toFixed(1)} km` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">ETA: </span>
              <span className="text-sky-400 font-bold">
                {ambAssignment?.eta_minutes ? `${Math.round(ambAssignment.eta_minutes)} min` : '—'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center space-x-2 text-[11px] font-mono text-sky-300">
            <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Direct Citizen Radio Link Active</span>
          </div>
        </div>
      </div>

      {/* PART 24: LIVE MAP */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-white font-mono flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              <span>LIVE GEOSPATIAL RESPONSE CORRIDOR</span>
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Deterministic routing • Real-time responder tracking • OpenStreetMap tiles
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-300 bg-cyan-950/40 px-3 py-1.5 rounded-xl border border-cyan-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>LIVE DATA FEED</span>
          </div>
        </div>

        <LiveEmergencyMap
          incidents={[incident]}
          resources={resources}
          selectedIncident={incident}
          height="520px"
          zoom={14}
        />
      </div>

      {/* PART 26: CITIZEN NOTIFICATION & AUDIT FLOW */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white font-mono flex items-center space-x-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>INCIDENT RESPONSE AUDIT TIMELINE</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {incidentNotifications.length} SYSTEM EVENT{incidentNotifications.length === 1 ? '' : 'S'}
          </span>
        </div>

        {incidentNotifications.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-4 text-center">
            Awaiting response team telemetry events...
          </div>
        ) : (
          <div className="space-y-3">
            {incidentNotifications.map((notif) => (
              <div
                key={notif.id}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3"
              >
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono">{notif.title}</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(notif.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-300 mt-1">{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Universal Share Modal */}
      {shareModalIncident && (
        <UniversalShareModal
          incident={shareModalIncident}
          onClose={() => setShareModalIncident(null)}
        />
      )}
    </div>
  );
};
