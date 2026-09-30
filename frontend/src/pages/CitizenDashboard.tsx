import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame, Car, MapPin, Send, CheckCircle2, AlertTriangle, Radio,
  Navigation, ShieldCheck, Clock, Share2, Copy, ArrowUpRight,
  Bell, Phone, HeartPulse, ChevronRight, AlertCircle, Shield,
  Search, Crosshair, Hospital as HospitalIcon, Check, ExternalLink,
  RotateCw, X
} from 'lucide-react';
import { useCrisisStore } from '../store/useCrisisStore';
import { useLocationStore } from '../store/useLocationStore';
import { api } from '../services/api';
import { Incident, IncidentType, IncidentSeverity, Resource } from '../types';
import { LiveEmergencyMap } from '../components/map/LiveEmergencyMap';
import { universalShareService } from '../services/universalShareService';
import { UniversalShareModal } from '../components/common/UniversalShareModal';
import { haversineDistanceKm, isValidCoordinate } from '../services/navigationService';

interface CitizenDashboardProps {
  currentPath?: string;
  navigate?: (path: string) => void;
}

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({ currentPath, navigate }) => {
  const { user, incidents, resources, notifications, fetchInitialData, markNotificationRead, markAllNotificationsRead } = useCrisisStore();

  // Centralized Device Location
  const {
    latitude: userLat,
    longitude: userLng,
    accuracy: userAccuracy,
    address: userAddress,
    status: userLocationStatus,
    errorMessage: userLocationError,
    detectLocation,
  } = useLocationStore();

  // Report Modal / Drawer State
  const [showReportModal, setShowReportModal] = useState(false);
  const [incidentType, setIncidentType] = useState<IncidentType>('fire');
  const [description, setDescription] = useState('');
  const [peopleAffected, setPeopleAffected] = useState(2);
  const [reportAddress, setReportAddress] = useState('');
  const [reportLat, setReportLat] = useState<number | null>(null);
  const [reportLng, setReportLng] = useState<number | null>(null);
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter / Search for My Incidents
  const [incidentSearch, setIncidentSearch] = useState('');
  const [incidentFilter, setIncidentFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');

  // UI Feedback
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [shareModalIncident, setShareModalIncident] = useState<Incident | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected incident for modal detail
  const [viewingIncident, setViewingIncident] = useState<Incident | null>(null);

  // Auto detect location on load
  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  // Sync GPS into report form
  useEffect(() => {
    if (userLocationStatus === 'detected' && userLat !== null && userLng !== null && !manualLocationMode) {
      setReportLat(userLat);
      setReportLng(userLng);
      if (userAddress) {
        setReportAddress(userAddress);
      }
    }
  }, [userLocationStatus, userLat, userLng, userAddress, manualLocationMode]);

  // Read URL query params on mount/change (e.g. ?incident=INC-001 or /report or /incidents)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const incParam = params.get('incident');
      if (incParam) {
        const found = incidents.find((i) => i.id === incParam);
        if (found) setViewingIncident(found);
      }
    }
    if (currentPath?.includes('/report')) {
      setShowReportModal(true);
    }
  }, [currentPath, incidents]);

  // Citizen's own incidents: match user ID, user email, or demo aliases
  const myIncidents = useMemo(() => {
    return incidents.filter((i) => {
      if (!user) return true;
      const uId = user.id;
      const uEmail = user.email?.toLowerCase();
      const repId = i.reported_by_id?.toLowerCase();
      
      const isOwner = repId === uId?.toLowerCase() || (uEmail && repId === uEmail);
      const isDemoMatch =
        (uId === 'usr_citizen_demo' || uId === 'usr_citizen_1' || uEmail?.includes('citizen@crisiscommand')) &&
        (repId === 'usr_citizen_demo' || repId === 'usr_citizen_1' || repId?.includes('citizen@crisiscommand'));
      
      return isOwner || isDemoMatch;
    });
  }, [incidents, user]);

  // Active incident: not resolved and not cancelled
  const myActiveIncident = useMemo(() => {
    return myIncidents.find((i) => i.status !== 'RESOLVED' && i.status !== 'CANCELLED');
  }, [myIncidents]);

  // Filtered list for "My Incidents" table/cards
  const filteredMyIncidents = useMemo(() => {
    return myIncidents.filter((i) => {
      if (incidentFilter === 'ACTIVE' && (i.status === 'RESOLVED' || i.status === 'CANCELLED')) return false;
      if (incidentFilter === 'RESOLVED' && i.status !== 'RESOLVED' && i.status !== 'CANCELLED') return false;
      if (incidentSearch.trim()) {
        const q = incidentSearch.toLowerCase();
        const matchesId = i.id.toLowerCase().includes(q);
        const matchesType = i.incident_type.toLowerCase().includes(q);
        const matchesAddr = i.address.toLowerCase().includes(q);
        const matchesDesc = i.description.toLowerCase().includes(q);
        const matchesStatus = i.status.toLowerCase().includes(q);
        return matchesId || matchesType || matchesAddr || matchesDesc || matchesStatus;
      }
      return true;
    });
  }, [myIncidents, incidentFilter, incidentSearch]);

  // Filtered notifications for Citizen
  const citizenNotifications = useMemo(() => {
    const uId = user?.id;
    return notifications.filter((n) => {
      if (n.recipient_role === 'ALL' || n.recipient_role === 'CITIZEN') return true;
      if (uId && n.recipient_user_id === uId) return true;
      if (myActiveIncident && n.incident_id === myActiveIncident.id) return true;
      return false;
    });
  }, [notifications, user, myActiveIncident]);

  // Nearby emergency services sorted by distance
  const nearbyServices = useMemo(() => {
    const lat = userLat ?? (myActiveIncident ? myActiveIncident.latitude : 12.9716);
    const lng = userLng ?? (myActiveIncident ? myActiveIncident.longitude : 77.5946);

    return resources
      .map((r) => {
        const dist = isValidCoordinate(r.latitude, r.longitude)
          ? haversineDistanceKm(lat, lng, r.latitude, r.longitude)
          : null;
        return { ...r, distanceKm: dist };
      })
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      .slice(0, 4);
  }, [resources, userLat, userLng, myActiveIncident]);

  // Dynamic 8-Stage Status Progression derived from backend incident + assignments
  const getDynamicStages = (incident: Incident) => {
    const activePlan = incident.plans?.find((p) => p.status === 'ACTIVE') || incident.plans?.[incident.plans.length - 1];
    const assignments = activePlan?.assignments || [];

    const hasHospitalAssigned = assignments.some((a) => a.resource_type === 'hospital');
    const hasFireAssigned = assignments.some((a) => a.resource_type === 'fire_team');
    const hasAnyAccepted = assignments.some((a) => a.status === 'ACCEPTED' || a.response_status === 'ACCEPTED');
    const hasAnyResponding = assignments.some((a) =>
      ['EN_ROUTE', 'ARRIVED', 'ON_SCENE', 'RESPONDING', 'PREPARING', 'PREPARED', 'RECEIVED'].includes(a.status)
    );
    const isResolved = incident.status === 'RESOLVED';
    const isCancelled = incident.status === 'CANCELLED';

    const stages = [
      { id: 'REPORTED', label: 'Reported', completed: true, active: false, time: incident.created_at },
      { id: 'BROADCASTED', label: 'Broadcasted', completed: !!incident.current_plan_id || assignments.length > 0, active: false },
      { id: 'HOSP_NOTIF', label: 'Hospital Notified', completed: hasHospitalAssigned, active: false },
      { id: 'FIRE_NOTIF', label: 'Fire Team Notified', completed: hasFireAssigned, active: false },
      { id: 'ACCEPTED', label: 'Accepted', completed: hasAnyAccepted || hasAnyResponding || isResolved, active: false },
      { id: 'RESPONDING', label: 'Responding', completed: hasAnyResponding || isResolved, active: false },
      { id: isCancelled ? 'CANCELLED' : 'RESOLVED', label: isCancelled ? 'Cancelled' : 'Resolved', completed: isResolved || isCancelled, active: false },
    ];

    // Determine currently active stage
    if (isResolved || isCancelled) {
      stages[stages.length - 1].active = true;
    } else if (hasAnyResponding) {
      stages[5].active = true;
    } else if (hasAnyAccepted) {
      stages[4].active = true;
    } else if (hasFireAssigned || hasHospitalAssigned) {
      stages[3].active = true;
    } else if (incident.current_plan_id) {
      stages[1].active = true;
    } else {
      stages[0].active = true;
    }

    return stages;
  };

  // Quick Action: open report with preselected type
  const openReport = (type: IncidentType) => {
    setIncidentType(type);
    setShowReportModal(true);
    if (!reportAddress && userAddress) {
      setReportAddress(userAddress);
    }
  };

  // Location Geocode
  const handleGeocode = async () => {
    if (!reportAddress.trim()) return;
    setIsGeocoding(true);
    try {
      const res = await api.geocode(reportAddress);
      if (res?.data) {
        setReportLat(res.data.latitude);
        setReportLng(res.data.longitude);
        setReportAddress(res.data.display_name);
        setManualLocationMode(true);
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Submit Emergency Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorToast(null);

    const targetLat = reportLat ?? userLat;
    const targetLng = reportLng ?? userLng;

    if (targetLat === null || targetLng === null) {
      setErrorToast('Please acquire your device GPS location or specify the incident location address.');
      setSubmitting(false);
      return;
    }

    try {
      const finalAddress = reportAddress.trim() || userAddress || `Coordinates (${targetLat.toFixed(5)}, ${targetLng.toFixed(5)})`;
      const res = await api.createIncident({
        incident_type: incidentType,
        description: description.trim() || `${incidentType.toUpperCase().replace('_', ' ')} reported by citizen requiring urgent emergency response`,
        people_affected: peopleAffected,
        latitude: targetLat,
        longitude: targetLng,
        accuracy: userAccuracy ?? undefined,
        location_captured_at: new Date().toISOString(),
        address: finalAddress,
        source_type: 'citizen_report',
        source_confidence: 0.98,
      });

      setSuccessToast(`Emergency report registered successfully. Incident ID: ${res.id}. First responders have been notified.`);
      setShowReportModal(false);
      setDescription('');
      await fetchInitialData();
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err: any) {
      console.error('Report submission error:', err);
      setErrorToast(err.message || 'Failed to submit report. Please retry or call emergency services directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (inc: Incident) => {
    const payload = universalShareService.formatIncidentShare(inc);
    universalShareService.copyUrl(payload.url);
    setCopiedId(inc.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-x-hidden">
      {/* Toast Feedback Alerts */}
      {successToast && (
        <div className="p-4 rounded-2xl liquid-glass-emerald border border-emerald-500/50 text-emerald-200 flex items-center justify-between shadow-glow-emerald animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-mono text-xs font-bold">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorToast && (
        <div className="p-4 rounded-2xl liquid-glass-rose border border-rose-500/50 text-rose-200 flex items-center justify-between shadow-glow-red animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-mono text-xs font-bold">{errorToast}</span>
          </div>
          <button onClick={() => setErrorToast(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================
          1. CITIZEN DASHBOARD TOP WELCOME SECTION
          ================================================== */}
      <div className="liquid-glass p-6 sm:p-8 rounded-3xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.12)] flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 mb-1.5">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold tracking-wider uppercase">CITIZEN RESPONSE PORTAL</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">ID: {user?.id || 'usr_citizen'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold font-display text-white tracking-tight">
            WELCOME, {user?.full_name ? user.full_name.toUpperCase() : 'CITIZEN'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-mono mt-1 max-w-2xl leading-relaxed">
            Crisis Command autonomous emergency network is active in your metropolitan grid.
            Report incidents with real-time GPS precision and receive immediate responder coordination.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center space-x-2 shadow-glow-emerald">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>NETWORK ONLINE</span>
          </div>

          <button
            onClick={() => setShowReportModal(true)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-mono font-bold text-xs tracking-wider transition-all shadow-glow-red hover:scale-105 active:scale-95 flex items-center space-x-2"
          >
            <Send className="w-4 h-4 animate-pulse" />
            <span>REPORT EMERGENCY</span>
          </button>
        </div>
      </div>

      {/* ==================================================
          2. CURRENT LOCATION / STATUS CARD
          ================================================== */}
      <div className="liquid-glass p-5 rounded-2xl border border-cyan-500/25 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0 shadow-glow">
            <MapPin className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">YOUR DETECTED LOCATION</span>
              {userAccuracy !== null && (
                <span className={`text-[10px] px-2 py-0.2 rounded font-mono font-bold ${
                  userAccuracy <= 50 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                }`}>
                  ±{Math.round(userAccuracy)}m GPS Fix
                </span>
              )}
            </div>
            <div className="text-xs sm:text-sm font-mono font-bold text-white truncate max-w-xl">
              {userAddress || (userLat && userLng ? `Latitude: ${userLat.toFixed(5)}°, Longitude: ${userLng.toFixed(5)}°` : 'Detecting current GPS coordinates...')}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => detectLocation(true)}
            disabled={userLocationStatus === 'detecting'}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center space-x-1.5 transition-all shadow-glow"
          >
            <Navigation className={`w-3.5 h-3.5 text-cyan-400 ${userLocationStatus === 'detecting' ? 'animate-spin' : ''}`} />
            <span>{userLocationStatus === 'detecting' ? 'ACQUIRING...' : 'RE-LOCK GPS'}</span>
          </button>
        </div>
      </div>

      {/* ==================================================
          3. QUICK EMERGENCY ACTIONS (1-CLICK DIRECT SOS)
          ================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => openReport('fire')}
          className="liquid-glass-rose p-4 sm:p-5 rounded-2xl text-left border border-rose-500/40 hover:border-rose-400 transition-all hover:scale-[1.02] active:scale-[0.98] group shadow-glow-red"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 group-hover:scale-110 transition-transform">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-white">REPORT FIRE</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Structural & Brush Fire</div>
        </button>

        <button
          onClick={() => openReport('road_accident')}
          className="liquid-glass-amber p-4 sm:p-5 rounded-2xl text-left border border-amber-500/40 hover:border-amber-400 transition-all hover:scale-[1.02] active:scale-[0.98] group shadow-glow-amber"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 group-hover:scale-110 transition-transform">
              <Car className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-white">ROAD ACCIDENT</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Vehicle Collision & Trauma</div>
        </button>

        <button
          onClick={() => openReport('road_accident')}
          className="liquid-glass p-4 sm:p-5 rounded-2xl text-left border border-cyan-500/40 hover:border-cyan-300 transition-all hover:scale-[1.02] active:scale-[0.98] group shadow-glow"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 group-hover:scale-110 transition-transform">
              <HeartPulse className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-white">MEDICAL SOS</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ambulance & Paramedic</div>
        </button>

        <a
          href="tel:112"
          className="liquid-glass-emerald p-4 sm:p-5 rounded-2xl text-left border border-emerald-500/40 hover:border-emerald-300 transition-all hover:scale-[1.02] active:scale-[0.98] group shadow-glow-emerald block"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 group-hover:scale-110 transition-transform">
              <Phone className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
          <div className="text-xs sm:text-sm font-bold font-mono text-white">HOTLINE 112</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Direct 24/7 Voice Dispatch</div>
        </a>
      </div>

      {/* ==================================================
          4. ACTIVE INCIDENT SECTION (OR CLEAN EMPTY STATE)
          ================================================== */}
      {myActiveIncident ? (
        <div className="liquid-glass p-6 sm:p-8 rounded-3xl border border-cyan-500/35 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-mono text-rose-400 font-bold uppercase tracking-wider">ACTIVE EMERGENCY RESPONSE</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 font-mono text-xs font-bold">{myActiveIncident.id}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white mt-1 uppercase">
                {myActiveIncident.title}
              </h2>
              <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>{myActiveIncident.address}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold ${
                myActiveIncident.severity === 'CRITICAL'
                  ? 'liquid-glass-rose text-rose-300 border border-rose-500/50 shadow-glow-red'
                  : 'liquid-glass-amber text-amber-300 border border-amber-500/50 shadow-glow-amber'
              }`}>
                {myActiveIncident.severity} PRIORITY
              </span>
              <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-glow flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>STATUS: {myActiveIncident.status}</span>
              </span>
            </div>
          </div>

          {/* DYNAMIC 8-STAGE STATUS PROGRESSION */}
          <div className="space-y-3">
            <div className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>LIVE INCIDENT LIFECYCLE (AUTOMATIC MULTI-AGENT SYNC)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {getDynamicStages(myActiveIncident).map((st) => (
                <div
                  key={st.id}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                    st.active
                      ? 'liquid-glass-accent border-cyan-400 text-cyan-200 shadow-glow scale-[1.02]'
                      : st.completed
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1.5">
                    {st.completed ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : st.active ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-700" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono font-bold leading-tight">{st.label}</div>
                  <div className="text-[9px] font-mono mt-1 text-slate-400">
                    {st.completed ? 'Completed' : st.active ? 'Active Now' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ASSIGNED EMERGENCY UNITS & ETA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {(() => {
              const activePlan = myActiveIncident.plans?.find((p) => p.status === 'ACTIVE') || myActiveIncident.plans?.[myActiveIncident.plans.length - 1];
              const asgs = activePlan?.assignments || [];
              const fireAsg = asgs.find((a) => a.resource_type === 'fire_team');
              const hospAsg = asgs.find((a) => a.resource_type === 'hospital');
              const ambAsg = asgs.find((a) => a.resource_type === 'ambulance');

              return (
                <>
                  <div className="p-4 rounded-2xl liquid-glass-card border border-slate-800 space-y-1">
                    <div className="flex items-center space-x-2 text-xs font-mono text-rose-400">
                      <Flame className="w-4 h-4" />
                      <span className="font-bold uppercase">Fire Team</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-white truncate">
                      {fireAsg?.resource_name || 'Station Alpha (Dispatched)'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Status: <span className="text-cyan-300 font-bold">{fireAsg?.status || 'EN ROUTE'}</span>
                      {fireAsg?.eta_minutes ? ` • ETA: ${Math.round(fireAsg.eta_minutes)}m` : ''}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl liquid-glass-card border border-slate-800 space-y-1">
                    <div className="flex items-center space-x-2 text-xs font-mono text-blue-400">
                      <HeartPulse className="w-4 h-4" />
                      <span className="font-bold uppercase">Emergency Ambulance</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-white truncate">
                      {ambAsg?.resource_name || 'Rapid Trauma ALS Unit'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Status: <span className="text-cyan-300 font-bold">{ambAsg?.status || 'DISPATCHED'}</span>
                      {ambAsg?.eta_minutes ? ` • ETA: ${Math.round(ambAsg.eta_minutes)}m` : ''}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl liquid-glass-card border border-slate-800 space-y-1">
                    <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400">
                      <HospitalIcon className="w-4 h-4" />
                      <span className="font-bold uppercase">Receiving Trauma Center</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-white truncate">
                      {hospAsg?.resource_name || 'Metro Central General Hospital'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Status: <span className="text-emerald-300 font-bold">{hospAsg?.status === 'PREPARING' ? 'BAYS PREPARED' : (hospAsg?.status || 'NOTIFIED')}</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* LIVE EMERGENCY MAP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="text-cyan-300 font-bold flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>LIVE SATELLITE & ROAD NAVIGATION VIEW</span>
              </span>
              <span className="text-emerald-400 font-bold">● Live GPS Feed Active</span>
            </div>
            <div className="rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl">
              <LiveEmergencyMap
                incidents={[myActiveIncident]}
                resources={resources}
                selectedIncident={myActiveIncident}
                center={[myActiveIncident.latitude, myActiveIncident.longitude]}
                zoom={14}
                height="280px"
              />
            </div>
          </div>

          {/* SHARE & TRACK BUTTONS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="text-xs font-mono text-slate-400">
              Share verified emergency tracking link with family or local authorities:
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShareModalIncident(myActiveIncident)}
                className="px-4 py-2 rounded-xl liquid-glass text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-glow hover:scale-105"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>SHARE INCIDENT</span>
              </button>
              <button
                onClick={() => handleCopyLink(myActiveIncident)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono flex items-center space-x-1.5 transition-colors"
              >
                {copiedId === myActiveIncident.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === myActiveIncident.id ? 'COPIED' : 'COPY LINK'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* CLEAN LIQUID GLASS EMPTY STATE CARD */
        <div className="liquid-glass p-8 sm:p-12 rounded-3xl border border-cyan-500/25 text-center space-y-4 shadow-[0_0_50px_rgba(6,182,212,0.08)]">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mx-auto shadow-glow">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-xl font-bold font-display text-white uppercase tracking-wider">
              ALL SYSTEMS STANDING BY — NO ACTIVE EMERGENCIES
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 font-mono mt-1.5 leading-relaxed">
              Your sector is currently all clear. If you witness or experience an emergency, you can request immediate dispatch with one click.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => setShowReportModal(true)}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-mono font-bold text-xs tracking-wider transition-all shadow-glow-red hover:scale-105 active:scale-95"
            >
              REPORT AN EMERGENCY
            </button>
          </div>
        </div>
      )}

      {/* ==================================================
          5. MY INCIDENTS (TABLE / HISTORY CARDS)
          ================================================== */}
      <div id="my-incidents" className="liquid-glass p-6 sm:p-8 rounded-3xl border border-cyan-500/25 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
              <Clock className="w-4 h-4" />
              <span className="font-bold uppercase tracking-wider">MY REPORTED INCIDENTS</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
              INCIDENT LOG & TRACKING ({filteredMyIncidents.length})
            </h3>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by ID, type, location..."
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-48 sm:w-60"
              />
            </div>

            <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700">
              {(['ALL', 'ACTIVE', 'RESOLVED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setIncidentFilter(tab)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    incidentFilter === tab
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-glow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredMyIncidents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs rounded-2xl liquid-glass-card border border-slate-800">
            No incidents found matching your query.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMyIncidents.map((inc) => (
              <div
                key={inc.id}
                className="p-5 rounded-2xl liquid-glass-card border border-slate-800 hover:border-cyan-500/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-cyan-400 font-bold text-xs">{inc.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        inc.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        inc.status === 'RESOLVED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {inc.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-base font-display mt-1">{inc.title}</h4>
                    <p className="text-xs text-slate-400 font-mono flex items-center space-x-1.5 mt-0.5">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">{inc.address}</span>
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-mono bg-black/40 p-2.5 rounded-xl line-clamp-2">
                  {inc.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                  <span>{new Date(inc.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setViewingIncident(inc)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-bold"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => setShareModalIncident(inc)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Share"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================================================
          6. NEARBY EMERGENCY SERVICES & NOTIFICATIONS GRID
          ================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nearby Emergency Services */}
        <div className="liquid-glass p-6 rounded-3xl border border-cyan-500/25 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <HospitalIcon className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                NEARBY EMERGENCY SERVICES
              </h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-400">Sorted by Distance</span>
          </div>

          <div className="space-y-3">
            {nearbyServices.map((svc) => (
              <div
                key={svc.id}
                className="p-3.5 rounded-2xl liquid-glass-card border border-slate-800/80 flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white truncate">{svc.name}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded uppercase font-bold bg-slate-800 text-slate-300">
                      {svc.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{svc.address}</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    ● Capacity: {svc.available_units} / {svc.capacity} available
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-cyan-300 font-mono">
                    {svc.distanceKm !== null ? `${svc.distanceKm.toFixed(1)} km` : 'Near Grid'}
                  </div>
                  <a
                    href={`tel:${svc.contact}`}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center justify-end space-x-1 mt-0.5"
                  >
                    <Phone className="w-2.5 h-2.5" />
                    <span>Call</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications & Recent Activity */}
        <div className="liquid-glass p-6 rounded-3xl border border-cyan-500/25 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                NOTIFICATIONS & ACTIVITY
              </h3>
            </div>
            {citizenNotifications.some((n) => !n.read) && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-[10px] font-mono text-cyan-400 hover:underline font-bold"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {citizenNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">
                No notifications received yet.
              </div>
            ) : (
              citizenNotifications.slice(0, 6).map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markNotificationRead(notif.id)}
                  className={`p-3 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                    !notif.read ? 'liquid-glass-accent border-cyan-500/40 text-cyan-200' : 'bg-slate-900/60 border-slate-800 text-slate-300 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold truncate">{notif.title}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ==================================================
          7. REPORT EMERGENCY MODAL (IN-PLACE WITHOUT NAVIGATION)
          ================================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass w-full max-w-xl rounded-3xl border border-cyan-500/40 p-6 sm:p-8 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-rose-400 font-bold uppercase tracking-wider">CIVIC SOS DISPATCH</span>
                <h3 className="text-xl font-bold font-display text-white mt-0.5">REPORT AN EMERGENCY</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              {/* Emergency Type Selector */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-2">SELECT EMERGENCY TYPE</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIncidentType('fire')}
                    className={`p-3.5 rounded-2xl text-left font-mono transition-all flex items-center space-x-3 ${
                      incidentType === 'fire'
                        ? 'liquid-glass-rose border-rose-400 text-rose-200 shadow-glow-red'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Flame className="w-5 h-5 text-rose-400" />
                    <div>
                      <div className="text-xs font-bold">FIRE EMERGENCY</div>
                      <div className="text-[10px] text-slate-400">Structural, industrial, brush</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncidentType('road_accident')}
                    className={`p-3.5 rounded-2xl text-left font-mono transition-all flex items-center space-x-3 ${
                      incidentType === 'road_accident'
                        ? 'liquid-glass-amber border-amber-400 text-amber-200 shadow-glow-amber'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Car className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-xs font-bold">ROAD ACCIDENT</div>
                      <div className="text-[10px] text-slate-400">Collision, trauma, rollover</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Observed Situation */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Observed Situation & Critical Details</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe smoke, visible flames, trapped passengers, casualties, or exact building floor..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

              {/* People affected range */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Estimated Casualties / People at Risk: <span className="text-cyan-300 font-bold">{peopleAffected}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={peopleAffected}
                  onChange={(e) => setPeopleAffected(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Location Input with Re-lock GPS */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-300 font-bold uppercase">Incident Location</label>
                  <button
                    type="button"
                    onClick={() => detectLocation(true)}
                    className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Use Live Device GPS</span>
                  </button>
                </div>

                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={reportAddress}
                    onChange={(e) => {
                      setReportAddress(e.target.value);
                      setManualLocationMode(true);
                    }}
                    placeholder="Enter street address, intersection, or landmark"
                    className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleGeocode}
                    disabled={isGeocoding || !reportAddress.trim()}
                    className="absolute right-1.5 top-1.5 px-3 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono hover:bg-cyan-900 disabled:opacity-50"
                  >
                    {isGeocoding ? 'Finding...' : 'Verify'}
                  </button>
                </div>

                {reportLat !== null && reportLng !== null && (
                  <div className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1.5">
                    <Check className="w-3 h-3" />
                    <span>Coordinates pinned: ({reportLat.toFixed(5)}°, {reportLng.toFixed(5)}°)</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl font-bold font-mono tracking-wider text-xs transition-all flex items-center justify-center space-x-2 disabled:opacity-50 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-glow-red mt-2"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'DISPATCHING EMERGENCY UNITS...' : 'DISPATCH EMERGENCY RESPONSE'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      {viewingIncident && (
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass w-full max-w-2xl rounded-3xl border border-cyan-500/40 p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase">{viewingIncident.id}</span>
                <h3 className="text-xl font-bold font-display text-white mt-0.5">{viewingIncident.title}</h3>
              </div>
              <button
                onClick={() => setViewingIncident(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Status</div>
                <div className="font-bold text-white mt-0.5">{viewingIncident.status}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Severity</div>
                <div className="font-bold text-rose-300 mt-0.5">{viewingIncident.severity}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">People At Risk</div>
                <div className="font-bold text-amber-300 mt-0.5">{viewingIncident.people_affected}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Plan</div>
                <div className="font-bold text-cyan-300 mt-0.5">{viewingIncident.current_plan_version || 'PLAN V1'}</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 text-xs font-mono">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Incident Description</div>
              <p className="text-slate-200 leading-relaxed">{viewingIncident.description}</p>
              <div className="text-[10px] text-slate-500 pt-1">Location: {viewingIncident.address}</div>
            </div>

            {/* Timeline */}
            {viewingIncident.timeline && viewingIncident.timeline.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-cyan-400 font-bold uppercase">Timeline of Operations</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {viewingIncident.timeline.map((evt: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-xl bg-black/40 border border-slate-800 text-[11px] font-mono flex items-start space-x-2">
                      <span className="text-cyan-400 shrink-0">•</span>
                      <div>
                        <div className="font-bold text-white">{evt.event}</div>
                        <div className="text-slate-400">{evt.details}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{new Date(evt.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShareModalIncident(viewingIncident)}
                className="px-4 py-2 rounded-xl liquid-glass text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold flex items-center space-x-1.5 shadow-glow"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
              <button
                onClick={() => setViewingIncident(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Universal Share Modal */}
      <UniversalShareModal
        incident={shareModalIncident}
        isOpen={!!shareModalIncident}
        onClose={() => setShareModalIncident(null)}
      />
    </div>
  );
};
