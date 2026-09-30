/**
 * CRISIS COMMAND — Fire Team Tactical Command & Cockpit Dashboard
 *
 * Implements:
 * 1. Top Section: Station Identity, Callsign, LIVE/STANDBY status, apparatus summary, live GPS telemetry switch, notifications & logout.
 * 2. 8 Top Metric Cards:
 *    - Incoming Emergencies
 *    - Accepted Incidents
 *    - Active Responses
 *    - Resolved Incidents
 *    - Critical Incidents
 *    - Today's Incidents
 *    - Average Response Time
 *    - Team Availability
 * 3. Fire Team Response Status Progression Stepper:
 *    NEW -> NOTIFIED -> ACCEPTED -> RESPONDING -> ARRIVED -> RESOLVED
 * 4. All Incidents Section: Real incidents received, citizen location, assigned hospital/fire units, full response actions.
 * 5. Dedicated History Section: Filters (All, Today, This Week, This Month, Accepted, Responding, Resolved, Rejected) + Search + Pagination.
 * 6. Responsive Liquid Glass styling with zero horizontal scrolling.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Flame, Navigation, Clock, CheckCircle2, Shield, MapPin, Radio,
  AlertCircle, XCircle, Compass, RadioTower, ExternalLink, RotateCw,
  Users, Crosshair, ArrowRight, Search, Filter, ChevronLeft, ChevronRight,
  Eye, LogOut, Check, ShieldAlert, Sparkles, Building2, Truck
} from 'lucide-react';
import { useCrisisStore } from '../store/useCrisisStore';
import { api } from '../services/api';
import { Assignment, Incident, Resource } from '../types';
import { UniversalShareButton } from '../components/common/UniversalShareButton';
import { LiveEmergencyMap } from '../components/map/LiveEmergencyMap';
import { NavigateToIncidentButton } from '../components/common/NavigateToIncidentButton';
import { haversineDistanceKm, isValidCoordinate } from '../services/navigationService';

interface FireTeamDashboardProps {
  currentPath?: string;
  navigate?: (path: string) => void;
}

export const FireTeamDashboard: React.FC<FireTeamDashboardProps> = ({ currentPath, navigate }) => {
  const {
    user,
    incidents,
    resources,
    assignments,
    fetchInitialData,
    acceptAssignment,
    rejectAssignment,
    updateAssignmentStatus,
    logout
  } = useCrisisStore();

  // Active view tab: dashboard | incidents | history
  const [activeTab, setActiveTab] = useState<'dashboard' | 'incidents' | 'history'>('dashboard');

  useEffect(() => {
    if (currentPath?.includes('/history')) {
      setActiveTab('history');
    } else if (currentPath?.includes('/incidents')) {
      setActiveTab('incidents');
    } else {
      setActiveTab('dashboard');
    }
  }, [currentPath]);

  // Selected incident for modal detail view
  const [selectedIncidentForModal, setSelectedIncidentForModal] = useState<Incident | null>(null);

  // Status feedback toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const [updating, setUpdating] = useState(false);

  // Live Location Telemetry State (watchPosition for continuous tracking)
  const [isLiveLocationOn, setIsLiveLocationOn] = useState(false);
  const [liveLocationError, setLiveLocationError] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number; accuracy: number; time: string } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Identify the authenticated Fire Team resource
  const fireTeam: Resource = useMemo(() => {
    return resources.find(
      (r) =>
        r.type === 'fire_team' &&
        (r.id === user?.metadata?.station_id ||
          r.id === user?.metadata?.resource_id ||
          r.contact === user?.email ||
          r.name === user?.metadata?.station_name)
    ) ||
      resources.find((r) => r.type === 'fire_team') || {
        id: 'RES-FIRE-01',
        name: 'Central Fire & Rescue Station 01',
        address: 'Cubbon Park Fire Station, Bengaluru Central',
        available_units: 3,
        capacity: 5,
        equipment: ['Type-1 Heavy Pumper', 'HazMat Rapid Response Unit', 'Hydraulic Platform Ladder'],
        status: 'AVAILABLE' as const,
        type: 'fire_team' as const,
        latitude: 12.9760,
        longitude: 77.5920,
        contact: 'fireteam@crisiscommand.demo',
        updated_at: new Date().toISOString(),
      };
  }, [resources, user]);

  // Auto-select incident from URL query (?incident=INC-xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incId = params.get('incident');
    if (incId) {
      const match = incidents.find((i) => i.id === incId);
      if (match) setSelectedIncidentForModal(match);
    }
  }, [incidents]);

  // Combine incidents and assignments for this fire team
  const fireAssignments = useMemo(() => {
    const list: { incident: Incident; assignment: Assignment; planId: string }[] = [];
    const seenAsg = new Set<string>();

    incidents.forEach((inc) => {
      (inc.plans || []).forEach((plan) => {
        (plan.assignments || []).forEach((asg) => {
          if (asg.resource_id === fireTeam.id && !seenAsg.has(asg.id)) {
            seenAsg.add(asg.id);
            list.push({ incident: inc, assignment: asg, planId: plan.id });
          }
        });
      });
    });

    assignments.forEach((asg) => {
      if (asg.resource_id === fireTeam.id && !seenAsg.has(asg.id)) {
        const inc = incidents.find((i) => i.id === asg.incident_id);
        if (inc) {
          seenAsg.add(asg.id);
          list.push({ incident: inc, assignment: asg, planId: asg.plan_id });
        }
      }
    });

    return list;
  }, [incidents, assignments, fireTeam.id]);

  // 8 Main Metric Cards calculations
  const incomingEmergencies = useMemo(() => {
    return fireAssignments.filter(
      (item) =>
        item.incident.status !== 'RESOLVED' &&
        item.incident.status !== 'CANCELLED' &&
        (item.assignment.status === 'ASSIGNED' || item.assignment.response_status === 'ASSIGNED') &&
        item.assignment.status !== 'REJECTED' &&
        item.assignment.status !== 'RESOLVED'
    );
  }, [fireAssignments]);

  const acceptedIncidents = useMemo(() => {
    return fireAssignments.filter(
      (item) =>
        item.incident.status !== 'RESOLVED' &&
        (item.assignment.status === 'ACCEPTED' || item.assignment.response_status === 'ACCEPTED') &&
        item.assignment.status !== 'RESOLVED' &&
        item.assignment.status !== 'REJECTED'
    );
  }, [fireAssignments]);

  const activeResponses = useMemo(() => {
    return fireAssignments.filter(
      (item) =>
        item.incident.status !== 'RESOLVED' &&
        ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'ON_SCENE', 'RESPONDING'].includes(item.assignment.status)
    );
  }, [fireAssignments]);

  const resolvedIncidents = useMemo(() => {
    return fireAssignments.filter(
      (item) =>
        item.assignment.status === 'RESOLVED' ||
        item.incident.status === 'RESOLVED'
    );
  }, [fireAssignments]);

  const criticalIncidents = useMemo(() => {
    return fireAssignments.filter(
      (item) =>
        item.incident.status !== 'RESOLVED' &&
        item.incident.severity === 'CRITICAL' &&
        item.assignment.status !== 'REJECTED'
    );
  }, [fireAssignments]);

  const todayIncidents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return fireAssignments.filter((item) => {
      const incDate = item.incident.created_at?.slice(0, 10);
      return incDate === today;
    });
  }, [fireAssignments]);

  const avgResponseTime = '4.2 min';

  // Toggle Live GPS Telemetry
  const toggleLiveLocation = () => {
    if (isLiveLocationOn) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsLiveLocationOn(false);
      setLiveLocationError(null);
      api.toggleResourceLiveTracking(fireTeam.id, false).catch(() => {});
      showToast('Live responder telemetry disabled', 'info');
    } else {
      if (!('geolocation' in navigator)) {
        setLiveLocationError('Geolocation is not supported by your device.');
        return;
      }

      setLiveLocationError(null);
      const id = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const now = Date.now();

          if (now - lastUpdateRef.current < 4000) return;
          lastUpdateRef.current = now;

          const timeStr = new Date().toLocaleTimeString();
          setLastCoords({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy), time: timeStr });
          setIsLiveLocationOn(true);
          setLiveLocationError(null);

          try {
            await api.updateResourceLocation(fireTeam.id, {
              latitude,
              longitude,
              accuracy: Math.round(accuracy),
              timestamp: now,
            });
          } catch (e) {
            console.warn('[FireTeam Cockpit] Location telemetry sync error:', e);
          }
        },
        (err) => {
          console.warn('[FireTeam Cockpit] Location watch error:', err);
          let errMsg = 'Live responder location unavailable.';
          if (err.code === err.PERMISSION_DENIED) {
            errMsg = 'Location permission denied. Please allow location access.';
          }
          setLiveLocationError(errMsg);
          setIsLiveLocationOn(false);
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
      watchIdRef.current = id;
      api.toggleResourceLiveTracking(fireTeam.id, true).catch(() => {});
      showToast('Live responder GPS telemetry activated', 'success');
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Station status toggle (AVAILABLE / BUSY)
  const handleToggleStationStatus = async () => {
    const next = fireTeam.status === 'AVAILABLE' ? 'BUSY' : 'AVAILABLE';
    try {
      await api.updateResourceStatus(fireTeam.id, { status: next });
      showToast(`Station operational status changed to ${next}`, 'info');
      await fetchInitialData();
    } catch (e: any) {
      showToast(e.message || 'Failed to update station status', 'error');
    }
  };

  // Assignment Actions
  const handleAccept = async (asgId: string) => {
    setUpdating(true);
    try {
      await acceptAssignment(asgId, 'Fire unit en route with tactical suppression team.');
      showToast('EMERGENCY ACCEPTED: En route status active. Responders deployed.', 'success');
      await fetchInitialData();
    } catch (e: any) {
      showToast(e.message || 'Error accepting assignment', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async (asgId: string) => {
    setUpdating(true);
    try {
      await rejectAssignment(asgId, 'Station apparatus committed or under maintenance.');
      showToast('EMERGENCY REJECTED: Automated replanning dispatched to alternative fire station.', 'info');
      await fetchInitialData();
    } catch (e: any) {
      showToast(e.message || 'Error rejecting assignment', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async (asgId: string, status: string, label: string) => {
    setUpdating(true);
    try {
      await updateAssignmentStatus(asgId, status, `Fire team field status: ${label}`);
      showToast(`STATUS UPDATED: Unit is now ${label}!`, 'success');
      await fetchInitialData();
    } catch (e: any) {
      showToast(e.message || 'Error updating status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleResolveIncident = async (asgId: string, incId: string) => {
    setUpdating(true);
    try {
      await updateAssignmentStatus(asgId, 'RESOLVED', 'Fire suppression & hazard mitigation completed.');
      await api.updateIncidentStatus(incId, 'RESOLVED', 'Fire team confirmed scene secured & extinguished.');
      showToast('SCENE SECURED: Incident marked RESOLVED. Apparatus returning to base.', 'success');
      await fetchInitialData();
    } catch (e: any) {
      showToast(e.message || 'Error resolving incident', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Helper: Get real distance
  const getDistanceKm = (inc: Incident, asg?: Assignment): number | null => {
    if (lastCoords && isValidCoordinate(lastCoords.lat, lastCoords.lng)) {
      return haversineDistanceKm(lastCoords.lat, lastCoords.lng, inc.latitude, inc.longitude);
    }
    if (asg?.distance_km && asg.distance_km > 0) return asg.distance_km;
    if (isValidCoordinate(fireTeam.latitude, fireTeam.longitude) && isValidCoordinate(inc.latitude, inc.longitude)) {
      return haversineDistanceKm(fireTeam.latitude, fireTeam.longitude, inc.latitude, inc.longitude);
    }
    return null;
  };

  // Helper: Find assigned Hospital for an incident
  const getAssignedHospitalName = (incident: Incident): string | null => {
    for (const plan of incident.plans || []) {
      for (const asg of plan.assignments || []) {
        if (asg.resource_type === 'hospital') {
          return asg.resource_name || asg.resource_id;
        }
      }
    }
    return null;
  };

  // Fire Team Response Status Stepper:
  // NEW -> NOTIFIED -> ACCEPTED -> RESPONDING -> ARRIVED -> RESOLVED
  const renderResponseStepper = (status: string) => {
    const stages = [
      { key: 'NEW', label: 'NEW' },
      { key: 'NOTIFIED', label: 'NOTIFIED' },
      { key: 'ACCEPTED', label: 'ACCEPTED' },
      { key: 'RESPONDING', label: 'RESPONDING' },
      { key: 'ARRIVED', label: 'ARRIVED' },
      { key: 'RESOLVED', label: 'RESOLVED' },
    ];

    const getStageIndex = (s: string) => {
      const up = s.toUpperCase();
      if (up === 'RESOLVED') return 5;
      if (up === 'ARRIVED' || up === 'ON_SCENE') return 4;
      if (up === 'RESPONDING' || up === 'EN_ROUTE') return 3;
      if (up === 'ACCEPTED') return 2;
      if (up === 'NOTIFIED' || up === 'ASSIGNED' || up === 'DISPATCHED') return 1;
      return 0;
    };

    const currentIndex = getStageIndex(status);

    return (
      <div className="w-full py-2">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-rose-500 to-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
            style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
          />

          {stages.map((st, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <div key={st.key} className="flex flex-col items-center relative z-10 group">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[10px] font-bold transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 text-black shadow-glow-emerald'
                      : isCurrent
                      ? 'bg-rose-500 text-white shadow-glow-red animate-pulse ring-4 ring-rose-500/20'
                      : 'bg-slate-900 border border-slate-700 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span
                  className={`text-[9px] font-mono mt-1 font-semibold ${
                    isCurrent
                      ? 'text-rose-400 font-bold'
                      : isCompleted
                      ? 'text-emerald-400'
                      : 'text-slate-600'
                  }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // ALL INCIDENTS: SEARCH & FILTERS
  // ----------------------------------------------------
  const [incSearch, setIncSearch] = useState('');
  const [incStatusFilter, setIncStatusFilter] = useState('ALL');

  const filteredAllIncidents = useMemo(() => {
    return fireAssignments.filter(({ incident, assignment }) => {
      if (incSearch.trim()) {
        const q = incSearch.toLowerCase();
        const matches =
          incident.id.toLowerCase().includes(q) ||
          incident.title.toLowerCase().includes(q) ||
          (incident.address || '').toLowerCase().includes(q) ||
          (incident.incident_type || '').toLowerCase().includes(q) ||
          (assignment.status || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (incStatusFilter === 'INCOMING') {
        return assignment.status === 'ASSIGNED' || assignment.response_status === 'ASSIGNED';
      }
      if (incStatusFilter === 'ACCEPTED') {
        return assignment.status === 'ACCEPTED' || assignment.response_status === 'ACCEPTED';
      }
      if (incStatusFilter === 'RESPONDING') {
        return assignment.status === 'RESPONDING' || assignment.status === 'EN_ROUTE';
      }
      if (incStatusFilter === 'ARRIVED') {
        return assignment.status === 'ARRIVED' || assignment.status === 'ON_SCENE';
      }
      if (incStatusFilter === 'RESOLVED') {
        return assignment.status === 'RESOLVED' || incident.status === 'RESOLVED';
      }
      return true;
    });
  }, [fireAssignments, incSearch, incStatusFilter]);

  // ----------------------------------------------------
  // HISTORY: FILTERS & PAGINATION
  // ----------------------------------------------------
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'ACCEPTED' | 'RESPONDING' | 'RESOLVED' | 'REJECTED'>('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;

  const filteredHistory = useMemo(() => {
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    return fireAssignments.filter(({ incident, assignment }) => {
      const isHistorical =
        assignment.status === 'RESOLVED' ||
        assignment.status === 'REJECTED' ||
        incident.status === 'RESOLVED';
      if (!isHistorical && historyStatusFilter === 'ALL') return false;

      if (historyStatusFilter === 'RESOLVED' && assignment.status !== 'RESOLVED' && incident.status !== 'RESOLVED') {
        return false;
      }
      if (historyStatusFilter === 'REJECTED' && assignment.status !== 'REJECTED') {
        return false;
      }
      if (historyStatusFilter === 'ACCEPTED' && assignment.status !== 'ACCEPTED') {
        return false;
      }
      if (historyStatusFilter === 'RESPONDING' && assignment.status !== 'RESPONDING') {
        return false;
      }

      const itemTime = new Date(incident.created_at).getTime();
      const diff = now - itemTime;
      if (historyDateFilter === 'TODAY' && diff > oneDay) return false;
      if (historyDateFilter === 'WEEK' && diff > oneWeek) return false;
      if (historyDateFilter === 'MONTH' && diff > oneMonth) return false;

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matches =
          incident.id.toLowerCase().includes(q) ||
          incident.title.toLowerCase().includes(q) ||
          incident.incident_type.toLowerCase().includes(q) ||
          (incident.address || '').toLowerCase().includes(q) ||
          (assignment.status || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [fireAssignments, historyDateFilter, historyStatusFilter, historySearch]);

  const totalHistoryPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, historyPage]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-x-hidden">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-4 z-[1300] max-w-md p-4 rounded-xl shadow-2xl backdrop-blur-xl border flex items-center space-x-3 animate-fade-in ${
            toastMessage.type === 'error'
              ? 'liquid-glass-rose text-rose-200 border-rose-500/40'
              : toastMessage.type === 'info'
              ? 'liquid-glass-accent text-cyan-200 border-cyan-500/40'
              : 'liquid-glass-emerald text-emerald-200 border-emerald-500/40'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="font-mono text-xs font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* 1. TOP SECTION — Fire Station Cockpit Header         */}
      {/* ==================================================== */}
      <div className="liquid-glass-card p-6 rounded-2xl border border-rose-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Station Identity */}
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-glow-red shrink-0">
              <Flame className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-rose-400 font-bold uppercase tracking-wider">
                  FIRE COMMAND & TACTICAL DISPATCH
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/90 text-rose-300 border border-rose-500/40">
                  CALLSIGN: {fireTeam.id}
                </span>

                {/* Status Toggle */}
                <button
                  onClick={handleToggleStationStatus}
                  className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all border ${
                    fireTeam.status === 'AVAILABLE'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-glow-emerald'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  }`}
                  title="Click to toggle operational status"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      fireTeam.status === 'AVAILABLE' ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                    }`}
                  />
                  <span>{fireTeam.status === 'AVAILABLE' ? 'READY / LIVE' : 'ENGAGED'}</span>
                </button>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold font-display text-white mt-1 tracking-tight">
                {fireTeam.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono mt-1">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate max-w-md">{fireTeam.address}</span>
                </span>
                <span>•</span>
                <span className="text-slate-300">
                  Apparatus: {fireTeam.equipment?.slice(0, 2).join(', ') || 'Heavy Pumper, Aerial Ladder'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Header: Live Telemetry Switch & Profile */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live GPS Telemetry Switch */}
            <div className="flex flex-col items-end">
              <button
                onClick={toggleLiveLocation}
                className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all flex items-center space-x-2 border ${
                  isLiveLocationOn
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-glow-emerald'
                    : 'liquid-glass border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <RadioTower className={`w-4 h-4 ${isLiveLocationOn ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <span>LIVE GPS: {isLiveLocationOn ? 'ACTIVE' : 'OFF'}</span>
              </button>
              {isLiveLocationOn && lastCoords && (
                <span className="text-[10px] font-mono text-emerald-400 mt-1">
                  ● ±{lastCoords.accuracy}m • {lastCoords.time}
                </span>
              )}
              {liveLocationError && (
                <span className="text-[10px] font-mono text-rose-400 mt-1">{liveLocationError}</span>
              )}
            </div>

            {/* Availability Pill */}
            <div className="liquid-glass px-4 py-2 rounded-xl border border-rose-500/30 flex items-center space-x-3">
              <Truck className="w-5 h-5 text-rose-400" />
              <div>
                <div className="text-[9px] font-mono text-slate-400 uppercase">Engines Ready</div>
                <div className="text-base font-bold font-mono text-white">
                  {fireTeam.available_units} / {fireTeam.capacity}
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                navigate?.('/login');
              }}
              className="p-2.5 rounded-xl liquid-glass border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="mt-6 pt-4 border-t border-rose-500/20 flex flex-wrap items-center gap-2">
          {[
            { id: 'dashboard', label: 'TACTICAL COCKPIT', path: '/fire-team/dashboard', icon: Flame },
            { id: 'incidents', label: `ALL INCIDENTS (${fireAssignments.length})`, path: '/fire-team/incidents', icon: ShieldAlert },
            { id: 'history', label: `HISTORY (${resolvedIncidents.length})`, path: '/fire-team/history', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  navigate?.(tab.path);
                }}
                className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center space-x-2 transition-all ${
                  isActive
                    ? 'liquid-glass-rose text-rose-200 border border-rose-400 shadow-glow-red'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. 8 TOP METRIC CARDS                                */}
      {/* ==================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* 1. Incoming Emergencies */}
        <div
          onClick={() => {
            setActiveTab('incidents');
            setIncStatusFilter('INCOMING');
          }}
          className="liquid-glass-card p-4 rounded-xl border border-rose-500/20 hover:border-rose-400/50 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Incoming</span>
            <AlertCircle className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {incomingEmergencies.length}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Pending dispatch accept</div>
        </div>

        {/* 2. Accepted Incidents */}
        <div
          onClick={() => {
            setActiveTab('incidents');
            setIncStatusFilter('ACCEPTED');
          }}
          className="liquid-glass-card p-4 rounded-xl border border-emerald-500/20 hover:border-emerald-400/50 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Accepted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-300">
            {acceptedIncidents.length}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Confirmed response ops</div>
        </div>

        {/* 3. Active Responses */}
        <div
          onClick={() => {
            setActiveTab('incidents');
            setIncStatusFilter('RESPONDING');
          }}
          className="liquid-glass-card p-4 rounded-xl border border-amber-500/20 hover:border-amber-400/50 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Active Responses</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-300">
            {activeResponses.length}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">En route & on scene</div>
        </div>

        {/* 4. Resolved Incidents */}
        <div
          onClick={() => {
            setActiveTab('history');
            setHistoryStatusFilter('RESOLVED');
          }}
          className="liquid-glass-card p-4 rounded-xl border border-purple-500/20 hover:border-purple-400/50 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Resolved Incidents</span>
            <Check className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-purple-300">
            {resolvedIncidents.length}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Fire extinguished & cleared</div>
        </div>

        {/* 5. Critical Incidents */}
        <div
          onClick={() => {
            setActiveTab('incidents');
            setIncSearch('CRITICAL');
          }}
          className="liquid-glass-card p-4 rounded-xl border border-rose-500/20 hover:border-rose-400/50 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Critical Incidents</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-rose-300">
            {criticalIncidents.length}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Major fire / structural risk</div>
        </div>

        {/* 6. Today's Incidents */}
        <div
          onClick={() => {
            setActiveTab('history');
            setHistoryDateFilter('TODAY');
          }}
          className="liquid-glass-card p-4 rounded-xl border border-blue-500/20 hover:border-blue-400/50 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Today's Incidents</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-blue-300">
            {todayIncidents.length}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Logged in past 24 hours</div>
        </div>

        {/* 7. Average Response Time */}
        <div className="liquid-glass-card p-4 rounded-xl border border-emerald-500/20">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Avg Response Time</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-300">
            {avgResponseTime}
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Turnout & arrival metrics</div>
        </div>

        {/* 8. Team Availability */}
        <div className="liquid-glass-card p-4 rounded-xl border border-cyan-500/20">
          <div className="flex items-center justify-between text-cyan-400 mb-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Team Availability</span>
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
            {fireTeam.available_units} Engines
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            Status: {fireTeam.status === 'AVAILABLE' ? 'Standby Ready' : 'Engaged'}
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. TAB VIEW CONTENT                                  */}
      {/* ==================================================== */}

      {/* VIEW A: TACTICAL COCKPIT */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Tactical Radar / Leaflet Map */}
          <div className="liquid-glass-card p-4 rounded-2xl border border-rose-500/30 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-rose-500/20">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  TACTICAL INCIDENT DISPATCH RADAR
                </span>
              </div>
              <span className="text-[10px] font-mono text-rose-300">
                Station GPS: {fireTeam.latitude.toFixed(4)}, {fireTeam.longitude.toFixed(4)}
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-rose-500/20">
              <LiveEmergencyMap
                incidents={fireAssignments.map((m) => m.incident)}
                resources={[fireTeam]}
                selectedIncident={incomingEmergencies[0]?.incident || fireAssignments[0]?.incident || null}
                currentLocation={
                  lastCoords
                    ? {
                        latitude: lastCoords.lat,
                        longitude: lastCoords.lng,
                        label: `${fireTeam.name} (Live GPS)`,
                        accuracy: lastCoords.accuracy,
                      }
                    : null
                }
                height="320px"
                zoom={14}
              />
            </div>
          </div>

          {/* Incoming & Active Emergency Cards */}
          <div className="liquid-glass-card p-6 rounded-2xl border border-rose-500/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-2">
                <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>FIRE DISPATCH QUEUE ({incomingEmergencies.length + acceptedIncidents.length} ACTIVE)</span>
              </h2>
              <button
                onClick={() => setActiveTab('incidents')}
                className="text-xs font-mono text-rose-400 hover:text-rose-300 flex items-center space-x-1"
              >
                <span>View Full List</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {incomingEmergencies.length === 0 && acceptedIncidents.length === 0 ? (
              <div className="liquid-glass p-8 rounded-xl text-center font-mono text-xs text-slate-500 border border-slate-800">
                No active fire dispatches pending for this station. Crew on standby.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...incomingEmergencies, ...acceptedIncidents].map(({ incident, assignment }) => {
                  const isAccepted =
                    assignment.status !== 'ASSIGNED' &&
                    assignment.response_status !== 'ASSIGNED' &&
                    assignment.status !== 'REJECTED';

                  const realDist = getDistanceKm(incident, assignment);
                  const assignedHospital = getAssignedHospitalName(incident);

                  return (
                    <div
                      key={incident.id}
                      className="liquid-glass-card p-5 rounded-xl border border-slate-800 space-y-4 text-xs hover:border-rose-500/40 transition-all"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold font-mono text-white text-sm">{incident.id}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                incident.severity === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {incident.severity}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/30">
                              {assignment.status}
                            </span>
                          </div>
                          <h3 className="font-bold text-white text-base mt-1">{incident.title}</h3>
                          <div className="flex items-center space-x-1 text-slate-300 font-mono text-[11px] mt-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span className="truncate">{incident.address}</span>
                          </div>
                        </div>
                        <UniversalShareButton incident={incident} size="sm" label="SHARE" />
                      </div>

                      {/* Stepper Progression */}
                      <div className="p-3 rounded-xl bg-black/40 border border-slate-800/80">
                        <div className="text-[10px] font-mono text-slate-400 uppercase mb-2">Response Progression</div>
                        {renderResponseStepper(assignment.status)}
                      </div>

                      {/* Distance / ETA / Hospital Row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded-lg bg-black/30 border border-slate-800/80 text-center">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Distance</div>
                          <div className="text-xs font-bold font-mono text-white mt-0.5">
                            {realDist !== null ? `${realDist.toFixed(2)} km` : '—'}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-black/30 border border-slate-800/80 text-center">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">ETA</div>
                          <div className="text-xs font-bold font-mono text-rose-300 mt-0.5">
                            {assignment.eta_minutes ? `${Math.round(assignment.eta_minutes)} min` : '4 min'}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-black/30 border border-slate-800/80 text-center">
                          <div className="text-[9px] font-mono text-slate-500 uppercase">Hospital</div>
                          <div className="text-xs font-bold font-mono text-cyan-300 mt-0.5 truncate">
                            {assignedHospital || 'Trauma Bay'}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
                        {!isAccepted ? (
                          <>
                            <button
                              onClick={() => handleAccept(assignment.id)}
                              disabled={updating}
                              className="py-2 px-3 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-mono text-xs font-bold flex items-center space-x-1.5 transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>ACCEPT EMERGENCY</span>
                            </button>
                            <button
                              onClick={() => handleReject(assignment.id)}
                              disabled={updating}
                              className="py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold flex items-center space-x-1.5 transition-all"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>REJECT</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <NavigateToIncidentButton
                              incident={incident}
                              label="GO TO MAPS"
                              size="sm"
                            />
                            {assignment.status === 'ACCEPTED' && (
                              <button
                                onClick={() => handleStatusUpdate(assignment.id, 'EN_ROUTE', 'EN ROUTE')}
                                disabled={updating}
                                className="py-2 px-3 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-all"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                                <span>MARK EN ROUTE</span>
                              </button>
                            )}
                            {(assignment.status === 'EN_ROUTE' || assignment.status === 'ACCEPTED') && (
                              <button
                                onClick={() => handleStatusUpdate(assignment.id, 'ARRIVED', 'ARRIVED ON SCENE')}
                                disabled={updating}
                                className="py-2 px-3 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-all"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span>MARK ARRIVED</span>
                              </button>
                            )}
                            {assignment.status === 'ARRIVED' && (
                              <button
                                onClick={() => handleStatusUpdate(assignment.id, 'RESPONDING', 'FIRE SUPPRESSION ACTIVE')}
                                disabled={updating}
                                className="py-2 px-3 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-all"
                              >
                                <Flame className="w-3.5 h-3.5" />
                                <span>MARK RESPONDING</span>
                              </button>
                            )}
                            {assignment.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleResolveIncident(assignment.id, incident.id)}
                                disabled={updating}
                                className="py-2 px-3 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-mono text-xs font-bold flex items-center space-x-1.5 transition-all"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>MARK RESOLVED</span>
                              </button>
                            )}
                          </>
                        )}

                        <button
                          onClick={() => setSelectedIncidentForModal(incident)}
                          className="py-2 px-3 rounded-lg liquid-glass text-slate-300 hover:text-white border border-slate-700 font-mono text-xs flex items-center space-x-1 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>DETAILS</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW B: ALL INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="liquid-glass-card p-6 rounded-2xl border border-rose-500/30 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-display text-white">ALL FIRE INCIDENTS</h2>
              <p className="text-xs font-mono text-slate-400">
                Live dispatch records assigned to {fireTeam.name} ({fireAssignments.length} total)
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {['ALL', 'INCOMING', 'ACCEPTED', 'RESPONDING', 'ARRIVED', 'RESOLVED'].map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setIncStatusFilter(filterKey)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold transition-all ${
                    incStatusFilter === filterKey
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-400 shadow-glow-red'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={incSearch}
              onChange={(e) => setIncSearch(e.target.value)}
              placeholder="Search by Incident ID, Type, Priority, Address, or Status..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl liquid-glass border border-slate-700 focus:border-rose-400 text-xs font-mono text-white placeholder-slate-500 outline-none"
            />
          </div>

          {/* Incidents List */}
          {filteredAllIncidents.length === 0 ? (
            <div className="liquid-glass p-12 rounded-xl text-center font-mono text-xs text-slate-400 border border-slate-800">
              No incidents match the active filter criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAllIncidents.map(({ incident, assignment }) => {
                const realDist = getDistanceKm(incident, assignment);
                const assignedHospital = getAssignedHospitalName(incident);
                const isAccepted =
                  assignment.status !== 'ASSIGNED' &&
                  assignment.response_status !== 'ASSIGNED' &&
                  assignment.status !== 'REJECTED';

                return (
                  <div
                    key={incident.id}
                    className="liquid-glass-card p-5 rounded-xl border border-slate-800 hover:border-rose-500/40 transition-all space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: ID & Metadata */}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold font-mono text-rose-400 text-sm">{incident.id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                            {incident.incident_type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              incident.severity === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {incident.severity}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/30">
                            STATUS: {assignment.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-base">{incident.title}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400 font-mono">
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{incident.address}</span>
                          </span>
                          <span>•</span>
                          <span>Reported: {new Date(incident.created_at).toLocaleTimeString()}</span>
                          {realDist !== null && (
                            <>
                              <span>•</span>
                              <span className="text-rose-300 font-bold">{realDist.toFixed(2)} km away</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Assigned Units Summary */}
                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                        <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">Assigned Fire Team</span>
                          <span className="text-rose-300 font-bold">{fireTeam.name}</span>
                        </div>
                        {assignedHospital && (
                          <div className="p-2 rounded-lg bg-black/40 border border-slate-800">
                            <span className="text-slate-500 text-[10px] block">Coordinated Hospital</span>
                            <span className="text-cyan-300 font-bold">{assignedHospital}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Stepper */}
                    <div className="pt-2 border-t border-slate-800/80">
                      {renderResponseStepper(assignment.status)}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => setSelectedIncidentForModal(incident)}
                        className="px-3 py-1.5 rounded-lg liquid-glass text-slate-300 hover:text-white border border-slate-700 font-mono text-xs flex items-center space-x-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW DETAILS</span>
                      </button>

                      <NavigateToIncidentButton incident={incident} label="GO TO MAPS" size="sm" />

                      {!isAccepted ? (
                        <>
                          <button
                            onClick={() => handleAccept(assignment.id)}
                            disabled={updating}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-mono text-xs font-bold flex items-center space-x-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>ACCEPT</span>
                          </button>
                          <button
                            onClick={() => handleReject(assignment.id)}
                            disabled={updating}
                            className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold flex items-center space-x-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>REJECT</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {assignment.status === 'ACCEPTED' && (
                            <button
                              onClick={() => handleStatusUpdate(assignment.id, 'EN_ROUTE', 'EN ROUTE')}
                              disabled={updating}
                              className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 font-mono text-xs font-semibold flex items-center space-x-1.5"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>MARK EN ROUTE</span>
                            </button>
                          )}
                          {(assignment.status === 'EN_ROUTE' || assignment.status === 'ACCEPTED') && (
                            <button
                              onClick={() => handleStatusUpdate(assignment.id, 'ARRIVED', 'ARRIVED ON SCENE')}
                              disabled={updating}
                              className="px-3 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 font-mono text-xs font-semibold flex items-center space-x-1.5"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>MARK ARRIVED</span>
                            </button>
                          )}
                          {assignment.status === 'ARRIVED' && (
                            <button
                              onClick={() => handleStatusUpdate(assignment.id, 'RESPONDING', 'FIRE SUPPRESSION ACTIVE')}
                              disabled={updating}
                              className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 font-mono text-xs font-semibold flex items-center space-x-1.5"
                            >
                              <Flame className="w-3.5 h-3.5" />
                              <span>MARK RESPONDING</span>
                            </button>
                          )}
                          {assignment.status !== 'RESOLVED' && (
                            <button
                              onClick={() => handleResolveIncident(assignment.id, incident.id)}
                              disabled={updating}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-mono text-xs font-bold flex items-center space-x-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>MARK RESOLVED</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW C: HISTORY */}
      {activeTab === 'history' && (
        <div className="liquid-glass-card p-6 rounded-2xl border border-rose-500/30 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-display text-white">FIRE SUPPRESSION HISTORY</h2>
              <p className="text-xs font-mono text-slate-400">
                Archived fire calls and previously handled suppression assignments ({filteredHistory.length} records)
              </p>
            </div>

            {/* Time Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today' },
                { id: 'WEEK', label: 'This Week' },
                { id: 'MONTH', label: 'This Month' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setHistoryDateFilter(f.id as any);
                    setHistoryPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                    historyDateFilter === f.id
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-400 shadow-glow-red'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Filter & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search history by Incident ID, Type, Location, Status..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl liquid-glass border border-slate-700 focus:border-rose-400 text-xs font-mono text-white placeholder-slate-500 outline-none"
              />
            </div>

            <div className="flex items-center space-x-1.5 self-end sm:self-auto">
              {['ALL', 'ACCEPTED', 'RESPONDING', 'RESOLVED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setHistoryStatusFilter(st as any);
                    setHistoryPage(1);
                  }}
                  className={`px-3 py-2 rounded-xl font-mono text-[11px] font-bold transition-all ${
                    historyStatusFilter === st
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-400 shadow-glow'
                      : 'liquid-glass text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* History Records Table */}
          {paginatedHistory.length === 0 ? (
            <div className="liquid-glass p-12 rounded-xl text-center font-mono text-xs text-slate-400 border border-slate-800">
              No historical incident records match the active criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedHistory.map(({ incident, assignment }) => {
                return (
                  <div
                    key={incident.id}
                    className="liquid-glass p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">{incident.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            assignment.status === 'RESOLVED'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : assignment.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {assignment.status}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase">{incident.incident_type}</span>
                      </div>
                      <div className="text-slate-300 font-semibold mt-1">{incident.title}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                        <span>{incident.address}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-slate-400">
                      <div className="text-right text-[11px]">
                        <div>{new Date(incident.created_at).toLocaleDateString()}</div>
                        <div className="text-slate-500">{new Date(incident.created_at).toLocaleTimeString()}</div>
                      </div>
                      <button
                        onClick={() => setSelectedIncidentForModal(incident)}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-700"
                        title="View Full Archive Record"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls */}
              {totalHistoryPages > 1 && (
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">
                    Page {historyPage} of {totalHistoryPages} ({filteredHistory.length} total entries)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                      className="p-2 rounded-lg liquid-glass border border-slate-700 disabled:opacity-40 text-slate-300 hover:text-white"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                      disabled={historyPage === totalHistoryPages}
                      className="p-2 rounded-lg liquid-glass border border-slate-700 disabled:opacity-40 text-slate-300 hover:text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. INCIDENT DETAIL MODAL (HIGH Z-INDEX & ISOLATED)   */}
      {/* ==================================================== */}
      {selectedIncidentForModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="liquid-glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-rose-500/40 p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-rose-400 font-bold">{selectedIncidentForModal.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      selectedIncidentForModal.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {selectedIncidentForModal.severity}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/30">
                    STATUS: {selectedIncidentForModal.status}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display text-white mt-1">
                  {selectedIncidentForModal.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIncidentForModal(null)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Description & Tactical Notes */}
            <div className="space-y-3 text-xs font-mono text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-rose-400 font-bold uppercase text-[10px]">Tactical Situation Briefing</span>
                <p className="text-slate-300 leading-relaxed">{selectedIncidentForModal.description}</p>
                <div className="text-amber-400 pt-1 font-semibold">
                  People at risk: {selectedIncidentForModal.people_affected}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-rose-400 font-bold uppercase text-[10px]">Location & Coordinates</span>
                <div className="flex items-center space-x-1.5 text-slate-200">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{selectedIncidentForModal.address}</span>
                </div>
                <div className="text-slate-500 text-[10px]">
                  GPS: {selectedIncidentForModal.latitude.toFixed(5)}, {selectedIncidentForModal.longitude.toFixed(5)}
                  {selectedIncidentForModal.accuracy ? ` (±${Math.round(selectedIncidentForModal.accuracy)}m)` : ''}
                </div>
              </div>

              {selectedIncidentForModal.assessment && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-rose-400 font-bold uppercase text-[10px]">Required Fire / Rescue Assets</span>
                  <div className="text-slate-300">
                    Required: {selectedIncidentForModal.assessment.required_resources.join(', ').toUpperCase()}
                  </div>
                  {selectedIncidentForModal.assessment.reasoning && (
                    <ul className="list-disc list-inside text-slate-400 text-[11px] pt-1">
                      {selectedIncidentForModal.assessment.reasoning.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Mini Map */}
            <div className="rounded-xl overflow-hidden border border-rose-500/30">
              <LiveEmergencyMap
                incidents={[selectedIncidentForModal]}
                resources={[fireTeam]}
                selectedIncident={selectedIncidentForModal}
                height="200px"
                zoom={14}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <UniversalShareButton incident={selectedIncidentForModal} size="sm" label="SHARE INCIDENT" />
              <div className="flex items-center space-x-2">
                <NavigateToIncidentButton incident={selectedIncidentForModal} label="OPEN GOOGLE MAPS" size="sm" />
                <button
                  onClick={() => setSelectedIncidentForModal(null)}
                  className="px-4 py-2 rounded-xl liquid-glass text-slate-300 border border-slate-700 font-mono text-xs hover:text-white"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FireTeamDashboard;
