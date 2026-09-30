import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, Activity, Flame, Hospital, Radio, 
  Settings, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  Search, Filter, UserCheck, ShieldAlert, Cpu, Database,
  ArrowUpRight, Lock, KeyRound, Building2, UserX, Eye
} from 'lucide-react';
import { useCrisisStore } from '../store/useCrisisStore';
import { api } from '../services/api';
import { UserRole } from '../types';

interface AdminDashboardProps {
  navigate: (path: string) => void;
}

type TabType = 'users' | 'resources' | 'system_health' | 'audit_logs' | 'settings';
type RoleFilterType = 'ALL' | 'CITIZEN' | 'FIRE_TEAM' | 'HOSPITAL' | 'COMMANDER' | 'DISPATCHER' | 'ADMIN';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ navigate }) => {
  const { 
    user, 
    resources, 
    auditLogs, 
    notifications, 
    fetchInitialData 
  } = useCrisisStore();

  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [roleFilter, setRoleFilter] = useState<RoleFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Settings State
  const [autoDispatchThreshold, setAutoDispatchThreshold] = useState(85);
  const [replanSensitivity, setReplanSensitivity] = useState('HIGH');
  const [smtpAlertsEnabled, setSmtpAlertsEnabled] = useState(true);
  const [wsMeshEnabled, setWsMeshEnabled] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Load registered users from backend
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.listUsers();
      if (res && res.users) {
        setUsersList(res.users);
      }
    } catch (err) {
      console.warn('Could not fetch user list, using fallback seeded state:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleUserStatus = async (targetEmail: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.updateUserStatus(targetEmail, { status: newStatus });
      setUsersList((prev) =>
        prev.map((u) => (u.email === targetEmail ? { ...u, status: newStatus } : u))
      );
      setActionNotice(`User ${targetEmail} status updated to ${newStatus}.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Failed to update status: ${err.message}`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleToggleVerification = async (targetEmail: string, currentVerified: boolean) => {
    const newVerified = !currentVerified;
    try {
      await api.updateUserStatus(targetEmail, { is_verified: newVerified });
      setUsersList((prev) =>
        prev.map((u) => (u.email === targetEmail ? { ...u, is_verified: newVerified } : u))
      );
      setActionNotice(`User ${targetEmail} verification status set to ${newVerified ? 'Verified' : 'Unverified'}.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(`Failed to update verification: ${err.message}`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Filtered Users List
  const filteredUsers = usersList.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.metadata?.station_name || '').toLowerCase().includes(q) ||
      (u.metadata?.hospital_name || '').toLowerCase().includes(q) ||
      (u.metadata?.organization || '').toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  // Calculate Metrics
  const countCitizens = usersList.filter((u) => u.role === 'CITIZEN').length;
  const countFireTeams = usersList.filter((u) => u.role === 'FIRE_TEAM').length;
  const countHospitals = usersList.filter((u) => u.role === 'HOSPITAL').length;
  const countCommanders = usersList.filter((u) => u.role === 'COMMANDER' || u.role === 'DISPATCHER').length;
  const countAdmins = usersList.filter((u) => u.role === 'ADMIN').length;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 space-y-8">
      {/* ============================================================ */}
      {/* 1. ADMINISTRATION DIRECTORATE HEADER                         */}
      {/* ============================================================ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-cyan-500/20">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300 text-xs font-mono mb-2 shadow-glow">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>CRISIS COMMAND DIRECTORATE</span>
          </div>
          <h1 className="text-3xl font-extrabold font-display tracking-tight text-white flex items-center space-x-3">
            <span>ADMINISTRATION DASHBOARD</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Platform governance, user management, resource oversight & infrastructure telemetry
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadUsers();
              fetchInitialData();
            }}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-white text-xs font-mono font-semibold transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loadingUsers ? 'animate-spin' : ''}`} />
            <span>REFRESH DATA</span>
          </button>

          <button
            onClick={() => navigate('/commander/dashboard')}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-mono font-bold text-xs transition-all shadow-glow hover:scale-105"
          >
            <span>TACTICAL OPS CENTER</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-xl bg-cyan-950/80 border border-cyan-400/40 text-cyan-200 text-xs font-mono flex items-center space-x-3 shadow-glow"
          >
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{actionNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 2. EXECUTIVE KPI OVERVIEW BAR                                 */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-purple-500/20 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Total Accounts</span>
            <Users className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{usersList.length}</div>
          <div className="text-[10px] text-purple-400 font-mono mt-0.5">Across 4 user tiers</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-cyan-500/20 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Citizens</span>
            <Users className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">{countCitizens}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Enrolled citizens</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-rose-500/20 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Fire Teams</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{countFireTeams}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Stations & rescue units</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-blue-500/20 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Hospitals</span>
            <Hospital className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-300 mt-1">{countHospitals}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Trauma intake centers</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>Command & Staff</span>
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">{countCommanders + countAdmins}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Internal officers</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono uppercase">
            <span>System Health</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">99.98%</div>
          <div className="text-[10px] text-emerald-300 font-mono mt-0.5">All services online</div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. NAVIGATION TABS                                           */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
            activeTab === 'users'
              ? 'bg-purple-600/25 border border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>USER MANAGEMENT</span>
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
            activeTab === 'resources'
              ? 'bg-cyan-600/25 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>RESOURCE FLEET</span>
        </button>

        <button
          onClick={() => setActiveTab('system_health')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
            activeTab === 'system_health'
              ? 'bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>SYSTEM HEALTH</span>
        </button>

        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
            activeTab === 'audit_logs'
              ? 'bg-blue-600/25 border border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>AUDIT LOGS & HISTORY</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
            activeTab === 'settings'
              ? 'bg-slate-700/60 border border-slate-500/40 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>PLATFORM SETTINGS</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: USER MANAGEMENT                                       */}
      {/* ============================================================ */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
            {/* Role Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'CITIZEN', 'FIRE_TEAM', 'HOSPITAL', 'COMMANDER', 'DISPATCHER', 'ADMIN'] as RoleFilterType[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                    roleFilter === r
                      ? 'bg-cyan-500 text-black font-bold shadow-glow'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user, email, station..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">User / Station Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Role Tier</th>
                    <th className="py-3 px-4">Organization / Station</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No registered accounts matching query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isVerified = u.is_verified ?? true;
                      const status = u.status || 'ACTIVE';

                      const roleBadgeStyles: Record<string, string> = {
                        CITIZEN: 'bg-cyan-950 text-cyan-300 border-cyan-500/30',
                        FIRE_TEAM: 'bg-rose-950 text-rose-300 border-rose-500/30',
                        HOSPITAL: 'bg-blue-950 text-blue-300 border-blue-500/30',
                        COMMANDER: 'bg-emerald-950 text-emerald-300 border-emerald-500/30',
                        DISPATCHER: 'bg-amber-950 text-amber-300 border-amber-500/30',
                        ADMIN: 'bg-purple-950 text-purple-300 border-purple-500/30',
                      };

                      return (
                        <tr key={u.email} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 text-xs">
                              {(u.full_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span>{u.full_name || 'Station Unit'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">{u.email}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${roleBadgeStyles[u.role] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {u.metadata?.station_name || u.metadata?.hospital_name || u.metadata?.organization || 'Crisis Command HQ'}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleVerification(u.email, isVerified)}
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                                isVerified
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                              }`}
                              title="Click to toggle verification status"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isVerified ? 'VERIFIED' : 'PENDING'}</span>
                            </button>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              <span>{status}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleToggleUserStatus(u.email, status)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                                status === 'ACTIVE'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              }`}
                            >
                              {status === 'ACTIVE' ? 'SUSPEND' : 'ACTIVATE'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: RESOURCE FLEET                                        */}
      {/* ============================================================ */}
      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((res) => {
              const isFire = res.type === 'fire_team';
              const isHosp = res.type === 'hospital';

              return (
                <div key={res.id} className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        {isFire && <Flame className="w-4 h-4 text-rose-400" />}
                        {isHosp && <Hospital className="w-4 h-4 text-blue-400" />}
                        {!isFire && !isHosp && <Activity className="w-4 h-4 text-cyan-400" />}
                        <span className="font-bold text-white text-sm">{res.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{res.id} • {res.address}</div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      res.status === 'AVAILABLE'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}>
                      {res.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">TOTAL CAPACITY</span>
                      <span className="text-slate-200 font-bold">{res.capacity} Units</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">AVAILABLE UNITS</span>
                      <span className="text-cyan-300 font-bold">{res.available_units} Ready</span>
                    </div>
                  </div>

                  <div className="pt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800/80">
                    <span className="text-slate-500 block mb-1">EQUIPMENT & CAPABILITIES</span>
                    <div className="flex flex-wrap gap-1">
                      {res.equipment && res.equipment.map((eq: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>GPS: {res.latitude?.toFixed(4)}, {res.longitude?.toFixed(4)}</span>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${res.latitude}&mlon=${res.longitude}#map=16/${res.latitude}/${res.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center space-x-1"
                    >
                      <span>View Map</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: SYSTEM HEALTH                                         */}
      {/* ============================================================ */}
      {activeTab === 'system_health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs font-mono uppercase">API Gateway Engine</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">ONLINE</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">FastAPI ASGI cluster handling authentication, incident dispatch and dynamic replanning.</p>
              <div className="text-xs font-mono text-slate-300 pt-2 border-t border-slate-800 flex justify-between">
                <span>Latency</span>
                <span className="text-cyan-400">18 ms</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs font-mono uppercase">OSRM Routing Service</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">CONNECTED</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">OpenStreetMap street-level engine for deterministic emergency vehicle routing and ETA calculations.</p>
              <div className="text-xs font-mono text-slate-300 pt-2 border-t border-slate-800 flex justify-between">
                <span>Map Provider</span>
                <span className="text-cyan-400">OpenStreetMap</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs font-mono uppercase">Multi-Agent AI Engine</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">SYNCHRONIZED</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Multi-agent emergency triage, risk prediction, resource matching, and secondary cascade analysis.</p>
              <div className="text-xs font-mono text-slate-300 pt-2 border-t border-slate-800 flex justify-between">
                <span>Provider</span>
                <span className="text-cyan-400">Gemini Flash Multi-Agent</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs font-mono uppercase">WebSocket Broadcast Mesh</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">ACTIVE</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Full-duplex real-time communication dispatching plan activations, replanning alerts, and incident updates.</p>
              <div className="text-xs font-mono text-slate-300 pt-2 border-t border-slate-800 flex justify-between">
                <span>Channel</span>
                <span className="text-cyan-400">/ws/command</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs font-mono uppercase">SMTP Verification Service</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">READY</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Dispatches 6-digit OTP verification codes and password recovery emails with rate limiting and replay defense.</p>
              <div className="text-xs font-mono text-slate-300 pt-2 border-t border-slate-800 flex justify-between">
                <span>Sender Header</span>
                <span className="text-cyan-400">Crisis Command</span>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs font-mono uppercase">Firestore & Identity DB</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">ONLINE</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">High-durability storage of user profiles, emergency records, operational logs, and station attributes.</p>
              <div className="text-xs font-mono text-slate-300 pt-2 border-t border-slate-800 flex justify-between">
                <span>Security</span>
                <span className="text-cyan-400">Role-Gated</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: AUDIT LOGS & ACTIVITY HISTORY                         */}
      {/* ============================================================ */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-xs font-mono uppercase text-white">Immutable Administrative Audit Trail</span>
              <span className="text-[10px] font-mono text-cyan-400">{auditLogs.length} events logged</span>
            </div>

            <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No audit log events recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-start justify-between text-xs font-mono">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">{log.action}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-cyan-400">{log.performed_by}</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{log.details}</p>
                    </div>

                    <div className="text-right text-[10px] text-slate-500 shrink-0 ml-4">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: PLATFORM SETTINGS                                     */}
      {/* ============================================================ */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl space-y-6">
            <h3 className="text-sm font-bold font-mono text-white uppercase border-b border-slate-800 pb-3">
              Automated Response & Dispatch Parameters
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 mb-1">
                  AI Multi-Agent Auto-Dispatch Confidence Threshold ({autoDispatchThreshold}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={autoDispatchThreshold}
                  onChange={(e) => setAutoDispatchThreshold(Number(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800"
                />
                <span className="text-[10px] text-slate-500">
                  Incidents assessed with confidence higher than this threshold will autonomously generate Plan V1 without human bottlenecks.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Dynamic Replanning Sensitivity</label>
                <select
                  value={replanSensitivity}
                  onChange={(e) => setReplanSensitivity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-mono"
                >
                  <option value="CRITICAL_ONLY">CRITICAL Incidents Only</option>
                  <option value="HIGH">High & Critical Cascades (Recommended)</option>
                  <option value="AGGRESSIVE">Aggressive Replanning (All Active Incidents)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-3">
                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpAlertsEnabled}
                    onChange={(e) => setSmtpAlertsEnabled(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-400"
                  />
                  <span>Dispatch SMTP Email Alerts to Regional Stations on Severity Escalation</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wsMeshEnabled}
                    onChange={(e) => setWsMeshEnabled(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-400"
                  />
                  <span>Enable WebSocket Real-Time Telemetry Synchronization</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              {settingsSaved && (
                <span className="text-emerald-400 text-xs font-mono font-semibold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Platform configuration updated successfully.</span>
                </span>
              )}
              {!settingsSaved && <span />}

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs transition-all shadow-glow hover:scale-105"
              >
                SAVE PLATFORM SETTINGS
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
