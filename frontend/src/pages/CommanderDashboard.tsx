import React, { useState } from 'react';
import { 
  Shield, Flame, Car, AlertTriangle, RefreshCw, Radio, 
  MapPin, Clock, Users, ArrowUpRight, CheckCircle2, 
  Share2, ChevronRight, Activity, Zap, Cpu, Sparkles 
} from 'lucide-react';
import { useCrisisStore } from '../store/useCrisisStore';
import { useLocationStore } from '../store/useLocationStore';
import { LocationBar } from '../components/common/LocationBar';
import { LiveEmergencyMap } from '../components/map/LiveEmergencyMap';
import { UniversalShareButton } from '../components/common/UniversalShareButton';
import { Incident, IncidentSeverity, ResourceStatus } from '../types';

export const CommanderDashboard: React.FC = () => {
  const { 
    incidents, 
    resources, 
    selectedIncident, 
    setSelectedIncident, 
    triggerReplan, 
    overrideCommander,
    fetchInitialData 
  } = useCrisisStore();

  const {
    latitude: userLat,
    longitude: userLng,
    accuracy: userAccuracy,
    address: userAddress,
  } = useLocationStore();

  const [filterType, setFilterType] = useState<'ALL' | 'fire' | 'road_accident'>('ALL');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('Executive Command operational adjustment');
  const [overrideLoading, setOverrideLoading] = useState(false);

  // Filtered incidents
  const filteredIncidents = incidents.filter((i) => {
    if (filterType === 'ALL') return true;
    return i.incident_type === filterType;
  });

  const activeIncident = selectedIncident || filteredIncidents[0] || null;

  // Active Plan for selected incident
  const activePlan = activeIncident?.plans?.find((p) => p.status === 'ACTIVE') || 
    (activeIncident?.plans && activeIncident.plans[activeIncident.plans.length - 1]);

  // Operational metrics
  const totalActive = incidents.filter((i) => i.status !== 'RESOLVED').length;
  const activeFires = incidents.filter((i) => i.incident_type === 'fire' && i.status !== 'RESOLVED').length;
  const activeAccidents = incidents.filter((i) => i.incident_type === 'road_accident' && i.status !== 'RESOLVED').length;
  const availableFireTeams = resources.filter((r) => r.type === 'fire_team' && r.status === 'AVAILABLE').length;
  const availableAmbulances = resources.filter((r) => r.type === 'ambulance' && r.status === 'AVAILABLE').length;
  const availableHospitals = resources.filter((r) => r.type === 'hospital').reduce((sum, h) => sum + h.available_units, 0);

  // Commander Override Action (ZERO APPROVAL GATES - Executes immediately!)
  const handleCommanderAction = async (actionType: string, payload?: any) => {
    if (!activeIncident) return;
    setOverrideLoading(true);
    try {
      if (actionType === 'BUMP_CRITICAL') {
        await overrideCommander({
          incident_id: activeIncident.id,
          action_type: 'CHANGE_SEVERITY',
          new_severity: 'CRITICAL',
          reason: overrideReason || 'Commander direct escalation to CRITICAL severity',
        });
      } else if (actionType === 'TRIGGER_REPLAN') {
        await triggerReplan(
          activeIncident.id,
          overrideReason || 'Commander forced dynamic re-optimization of response units',
          activeIncident.severity
        );
      } else if (actionType === 'MARK_AMB_UNAVAILABLE' && payload?.resourceId) {
        await overrideCommander({
          incident_id: activeIncident.id,
          action_type: 'MARK_UNAVAILABLE',
          resource_id: payload.resourceId,
          reason: 'Commander flagged vehicle mechanical fault',
        });
      }
      await fetchInitialData();
    } catch (e) {
      console.error('Commander action failed:', e);
    } finally {
      setOverrideLoading(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
      {/* Centralized Dynamic Location Telemetry Bar */}
      <LocationBar />

      {/* 1. Tactical Ops KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Active Incidents</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{totalActive}</div>
          <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Real-time synchronized</div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-rose-500/20">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Active Fires</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{activeFires}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Hydraulic & foam active</div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-amber-500/20">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Road Crashes</span>
            <Car className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{activeAccidents}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Extrication / trauma units</div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-red-500/20">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Ready Fire Teams</span>
            <Shield className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{availableFireTeams} / 5</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Standby at station bays</div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-blue-500/20">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Ready Ambulances</span>
            <Zap className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{availableAmbulances} / 5</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">ALS & Mobile ICU units</div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Hospital Trauma Beds</span>
            <Users className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">{availableHospitals}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">5 Regional trauma centers</div>
        </div>
      </div>

      {/* 2. Main 3-Column Command Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Active Incidents List (3 Cols) */}
        <div className="lg:col-span-3 glass-panel p-4 rounded-2xl border border-cyan-500/20 flex flex-col h-[750px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">ACTIVE INCIDENTS</h2>
              <p className="text-[10px] text-slate-400 font-mono">{filteredIncidents.length} Events on radar</p>
            </div>
            {/* Filter buttons */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded ${filterType === 'ALL' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                ALL
              </button>
              <button
                onClick={() => setFilterType('fire')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded ${filterType === 'fire' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                FIRE
              </button>
              <button
                onClick={() => setFilterType('road_accident')}
                className={`px-2 py-0.5 text-[10px] font-mono rounded ${filterType === 'road_accident' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                CRASH
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 mt-3 pr-1">
            {filteredIncidents.map((inc) => {
              const isSelected = activeIncident?.id === inc.id;
              const isCritical = inc.severity === 'CRITICAL';
              const isHigh = inc.severity === 'HIGH';

              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-400 shadow-glow'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1.5">
                      {inc.incident_type === 'fire' ? (
                        <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <Car className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="font-bold text-xs text-white truncate max-w-[140px]">{inc.title}</span>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                          : isHigh
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 line-clamp-1">{inc.address}</div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                    <span className="text-cyan-400 font-semibold">{inc.current_plan_version || 'PLAN V1'}</span>
                    <span className="text-slate-500">{inc.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Live Emergency Map & Active Route Vectors (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="glass-panel p-2 rounded-2xl border border-cyan-500/20">
            <LiveEmergencyMap
              incidents={incidents}
              resources={resources}
              selectedIncident={activeIncident}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
              currentLocation={
                userLat !== null && userLng !== null
                  ? {
                      latitude: userLat,
                      longitude: userLng,
                      label: userAddress || 'Commander Location',
                      accuracy: userAccuracy || undefined,
                    }
                  : null
              }
              height="500px"
            />
          </div>

          {/* Quick Active Route Telemetry Panel */}
          {activeIncident && activePlan && (
            <div className="glass-panel p-3.5 rounded-2xl border border-cyan-500/20">
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-cyan-300 font-bold uppercase flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ACTIVE DISPATCH CORRIDORS ({activePlan.version})</span>
                </span>
                <span className="text-emerald-400 font-mono">SIREN PRIORITY ENGAGED</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {activePlan.assignments.map((asg) => (
                  <div key={asg.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200 truncate max-w-[150px]">{asg.resource_name}</div>
                      <div className="text-[10px] text-slate-400">{asg.distance_km} km • {asg.route_summary}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-cyan-400">{asg.eta_minutes}m</span>
                      <div className="text-[9px] text-emerald-400 font-bold">EN ROUTE</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Triage, Response Plan Evolution & Commander Overrides (4 Cols) */}
        <div className="lg:col-span-4 glass-panel p-4 rounded-2xl border border-cyan-500/20 flex flex-col h-[750px] overflow-y-auto space-y-4">
          {activeIncident ? (
            <>
              {/* Selected Incident Banner */}
              <div className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-400 font-bold">TACTICAL INSPECTOR</span>
                  <div className="flex items-center space-x-2">
                    <UniversalShareButton incident={activeIncident} size="sm" label="SHARE ALERT" />
                    <span className="text-xs font-mono text-slate-500">{activeIncident.id}</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white font-display mt-1">{activeIncident.title}</h3>
                <p className="text-xs text-slate-300 mt-1">{activeIncident.description}</p>
                <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400 mt-2">
                  <span>📍 {activeIncident.address}</span>
                  <span>👥 {activeIncident.people_affected} affected</span>
                </div>
              </div>

              {/* Source Trust & Conflict System (Section 33 & 36) */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 uppercase">Telemetry Source:</span>
                  <span className="text-cyan-400 font-semibold uppercase">{activeIncident.source_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Source Trust Confidence:</span>
                  <span className="text-emerald-400 font-semibold">{Math.round(activeIncident.source_confidence * 100)}%</span>
                </div>
                {activeIncident.assessment?.source_conflict && (
                  <div className="mt-2 p-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px]">
                    ⚠️ SOURCE CONFLICT DETECTED: Caller & sensor discrepancies resolved conservatively.
                  </div>
                )}
              </div>

              {/* AI Assessment Agent Reasoning (Section 17, 53) */}
              {activeIncident.assessment && (
                <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-400 font-mono font-bold">
                    <Cpu className="w-4 h-4 text-cyan-300" />
                    <span>AI MULTI-AGENT TRIAGE REASONING</span>
                  </div>
                  <ul className="space-y-1 text-slate-300 text-[11px] list-disc list-inside">
                    {activeIncident.assessment.reasoning.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Response Plan Evolution: Plan V1 -> Plan V2 (Section 22, 23) */}
              {activePlan && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-glow text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-cyan-300 text-sm">{activePlan.version} ACTIVE</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      AUTO-EXECUTED
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300">
                    <strong>Rationale:</strong> {activePlan.change_reason || 'Autonomous proximity optimization'}
                  </div>

                  {activePlan.why_plan_changed && activePlan.why_plan_changed.length > 0 && (
                    <div className="p-2 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-slate-300 space-y-1">
                      <div className="text-cyan-400 font-bold">WHY PLAN EVOLVED:</div>
                      {activePlan.why_plan_changed.map((why, idx) => (
                        <div key={idx}>• {why}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Commander Manual Override Controls (Section 25, 55 - ZERO CONFIRMATION DIALOGS!) */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-500/30 space-y-3">
                <div className="flex items-center space-x-2 text-rose-400 font-mono font-bold text-xs">
                  <Shield className="w-4 h-4 text-rose-400" />
                  <span>COMMANDER MANUAL OVERRIDE (ZERO POPUPS)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Immediate intervention. Action executes on click and logs audit record.
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Override justification (saved to audit trail)..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none font-mono"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCommanderAction('BUMP_CRITICAL')}
                      disabled={overrideLoading}
                      className="py-2 px-2.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 text-xs font-mono font-semibold transition-all disabled:opacity-50"
                      title="Instantly bumps severity to CRITICAL"
                    >
                      ⚡ Escalate to CRITICAL
                    </button>

                    <button
                      onClick={() => handleCommanderAction('TRIGGER_REPLAN')}
                      disabled={overrideLoading}
                      className="py-2 px-2.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-mono font-semibold transition-all disabled:opacity-50"
                      title="Autonomously recalculates and generates next plan version"
                    >
                      🔄 Re-optimize Plan
                    </button>
                  </div>
                </div>
              </div>

              {/* Incident History & Timeline (Section 38) */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                <span className="font-mono font-bold text-slate-300 text-xs uppercase">Incident Execution Timeline</span>
                <div className="space-y-2 mt-2">
                  {activeIncident.timeline?.map((item, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-[11px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-200">{item.event}</div>
                        <div className="text-[10px] text-slate-400">{item.details}</div>
                        <div className="text-[9px] text-slate-500 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-slate-500 text-xs font-mono">
              Select an incident from the radar to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
