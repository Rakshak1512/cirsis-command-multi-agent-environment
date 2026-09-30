import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Mail, AlertCircle, ArrowRight, Sparkles,
  Shield, Flame, Hospital, User, ArrowLeft, Eye, EyeOff
} from 'lucide-react';
import { api } from '../services/api';
import { useCrisisStore } from '../store/useCrisisStore';

interface LoginPageProps {
  navigate: (path: string) => void;
}

type LoginRole = 'citizen' | 'fire_team' | 'hospital' | 'admin';

interface RoleOption {
  id: LoginRole;
  label: string;
  icon: React.ElementType;
  description: string;
  badgeColor: string;
  glowColor: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'citizen',
    label: 'CITIZEN',
    icon: User,
    description: 'Civic SOS & Incident Tracking',
    badgeColor: 'text-cyan-300',
    glowColor: 'rgba(6, 182, 212, 0.35)',
  },
  {
    id: 'fire_team',
    label: 'FIRE TEAM',
    icon: Flame,
    description: 'Engine Unit & Tactical Dispatch',
    badgeColor: 'text-rose-400',
    glowColor: 'rgba(244, 63, 94, 0.35)',
  },
  {
    id: 'hospital',
    label: 'HOSPITAL',
    icon: Hospital,
    description: 'Emergency Intake & Triage',
    badgeColor: 'text-blue-400',
    glowColor: 'rgba(59, 130, 246, 0.35)',
  },
  {
    id: 'admin',
    label: 'ADMIN',
    icon: Shield,
    description: 'Command & Directorate',
    badgeColor: 'text-purple-400',
    glowColor: 'rgba(168, 85, 247, 0.35)',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ navigate }) => {
  // Section 7: Default selected role is citizen
  const [selectedRole, setSelectedRole] = useState<LoginRole>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberStation, setRememberStation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoActionLoading, setDemoActionLoading] = useState<string | null>(null);

  const { setUser } = useCrisisStore();

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.DEV;

  // Section 16: ONLY FOUR DEMO ACCOUNTS (Citizen, Fire Team, Hospital, Admin)
  const demoAccounts = [
    {
      roleName: 'CITIZEN',
      roleId: 'citizen' as LoginRole,
      btnLabel: 'LOGIN AS CITIZEN',
      email: 'citizen@crisiscommand.demo',
      password: 'Citizen@123',
      icon: User,
      textColor: 'text-cyan-300',
      borderStyle: 'border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/10',
    },
    {
      roleName: 'FIRE TEAM',
      roleId: 'fire_team' as LoginRole,
      btnLabel: 'LOGIN AS FIRE TEAM',
      email: 'fireteam@crisiscommand.demo',
      password: 'FireTeam@123',
      icon: Flame,
      textColor: 'text-rose-400',
      borderStyle: 'border-rose-500/30 hover:border-rose-400 hover:bg-rose-500/10',
    },
    {
      roleName: 'HOSPITAL',
      roleId: 'hospital' as LoginRole,
      btnLabel: 'LOGIN AS HOSPITAL',
      email: 'hospital@crisiscommand.demo',
      password: 'Hospital@123',
      icon: Hospital,
      textColor: 'text-blue-400',
      borderStyle: 'border-blue-500/30 hover:border-blue-400 hover:bg-blue-500/10',
    },
    {
      roleName: 'ADMIN',
      roleId: 'admin' as LoginRole,
      btnLabel: 'LOGIN AS ADMIN',
      email: 'admin@crisiscommand.demo',
      password: 'Admin@123',
      icon: Shield,
      textColor: 'text-purple-400',
      borderStyle: 'border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/10',
    },
  ];

  // Section 8, 9, 10: Server-Verified Role Authentication
  const executeLogin = async (targetEmail: string, targetPassword: string, roleToVerify: LoginRole) => {
    setError(null);
    setLoading(true);

    try {
      // Send both role and selected_role to backend for strict server-side verification
      const res = await api.login({
        email: targetEmail.trim().toLowerCase(),
        password: targetPassword,
        role: roleToVerify,
        selected_role: roleToVerify,
      });

      setUser(res.user, res.access_token);

      // Section 11: Role-Based Redirection
      const userRole = (res.user?.role || '').toLowerCase();
      if (userRole.includes('fire')) {
        navigate('/fire-team/dashboard');
      } else if (userRole.includes('hosp')) {
        navigate('/hospital/dashboard');
      } else if (userRole.includes('admin') || userRole.includes('command') || userRole.includes('dispatch')) {
        navigate('/commander/dashboard');
      } else {
        navigate('/citizen/dashboard');
      }
    } catch (err: any) {
      const msg = err.message || 'Unable to connect to Crisis Command. Please try again.';
      if (msg.includes('401') || msg.toLowerCase().includes('invalid email')) {
        setError('Invalid email or password.');
      } else if (msg.toLowerCase().includes('not found')) {
        setError('Account not found. Please create an account first.');
      } else if (msg.toLowerCase().includes('verify your email')) {
        setError('Please verify your email before signing in.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setDemoActionLoading(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    executeLogin(email, password, selectedRole);
  };

  // Section 16: Demo Account Selection Flow
  const handleDemoQuickLogin = (acc: typeof demoAccounts[0]) => {
    setSelectedRole(acc.roleId);
    setEmail(acc.email);
    setPassword(acc.password);
    setDemoActionLoading(acc.roleId);
    executeLogin(acc.email, acc.password, acc.roleId);
  };

  const activeRoleConfig = ROLE_OPTIONS.find((r) => r.id === selectedRole) || ROLE_OPTIONS[0];

  return (
    <div className="min-h-screen bg-[#050811] text-white flex flex-col justify-center items-center relative overflow-hidden py-12 px-4 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Liquid Glass Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[550px] bg-gradient-to-b from-cyan-600/15 via-blue-600/10 to-transparent blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[400px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[400px] h-[400px] bg-rose-600/5 blur-[140px] rounded-full pointer-events-none" />

      {/* Cyber Subtle Grid Texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top Bar Navigation */}
      <div className="w-full max-w-lg mb-6 z-10 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center space-x-2 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 backdrop-blur-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>BACK TO CRISIS COMMAND</span>
        </button>

        <div className="flex items-center space-x-2 text-[11px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-800/40 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>AUTHENTICATION GATEWAY</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CENTERED AUTHENTICATION CONTAINER                            */}
      {/* ============================================================ */}
      <div className="w-full max-w-lg mx-auto z-10 space-y-6">
        {/* Title & Brand Header */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white uppercase flex items-center justify-center space-x-2.5">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400">
              CRISIS COMMAND
            </span>
          </h1>
          <p className="text-xs font-mono tracking-widest text-cyan-300/80 uppercase">
            SECURE EMERGENCY NETWORK
          </p>
        </div>

        {/* ============================================================ */}
        {/* SECTION 4, 5, 6: ROLE SELECTOR AT TOP (ANIMATED LIQUID GLASS) */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 gap-2.5 p-1.5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl relative">
          {ROLE_OPTIONS.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;

            return (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setSelectedRole(role.id);
                  setError(null);
                }}
                className={`relative px-4 py-3 rounded-xl text-left transition-all duration-200 flex items-center space-x-3 overflow-hidden group focus:outline-none ${
                  isSelected
                    ? 'border border-cyan-400/60 bg-gradient-to-b from-cyan-500/20 to-blue-600/10 text-white shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                    : 'border border-transparent bg-slate-900/40 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Framer-Motion Active Highlight Indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="activeRoleIndicator"
                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/15 via-sky-500/10 to-blue-500/15 pointer-events-none border border-cyan-400/40 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                      : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 group-hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="overflow-hidden z-10">
                  <div className="flex items-center space-x-1.5">
                    {isSelected && <span className="text-cyan-400 text-xs">✦</span>}
                    <span className="text-xs font-bold font-mono tracking-wider">{role.label}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                    {role.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* MAIN LIQUID GLASS LOGIN CARD                                 */}
        {/* ============================================================ */}
        <div className="p-7 sm:p-8 rounded-3xl bg-slate-900/60 border border-cyan-500/25 shadow-[0_8px_32px_0_rgba(0,180,216,0.12)] backdrop-blur-2xl space-y-6 relative overflow-hidden">
          {/* Subtle Inner Glow Highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

          {/* Card Header with active role badge */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div>
              <h2 className="text-xl font-black font-display tracking-tight text-white uppercase">
                WELCOME BACK
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Sign in to your authorized station credentials
              </p>
            </div>

            <div className="px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-[10px] font-mono font-bold tracking-wider text-cyan-300 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>{activeRoleConfig.label}</span>
            </div>
          </div>

          {/* Glass Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2.5 font-mono shadow-[0_0_15px_rgba(244,63,94,0.15)]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
                  placeholder="station@crisiscommand.demo"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberStation}
                  onChange={(e) => setRememberStation(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-400 focus:ring-0"
                />
                <span>Remember terminal</span>
              </label>

              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-cyan-400 hover:text-cyan-300 transition-colors hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            {/* Section 20: LOGIN BUTTON STATES */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold font-mono tracking-wider text-xs transition-all shadow-[0_0_25px_rgba(6,182,212,0.35)] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>{loading ? 'AUTHENTICATING...' : 'LOGIN →'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Section 14: CREATE ACCOUNT LINK */}
          <div className="text-center pt-2 border-t border-slate-800/80">
            <span className="text-xs font-mono text-slate-400">Need to enroll in Crisis Command? </span>
            <button
              type="button"
              onClick={() => navigate('/create-account')}
              className="text-xs font-mono text-cyan-400 font-bold hover:underline"
            >
              Create Account
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION 16: DEMO ACCOUNTS (ONLY Citizen, Fire, Hosp, Admin)  */}
        {/* ============================================================ */}
        {isDemoMode && (
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-cyan-500/20 backdrop-blur-xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
              <span className="flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>DEMO ACCOUNTS</span>
              </span>
              <span className="text-[10px] text-slate-500 lowercase">click to auto-fill & verify</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => {
                const Icon = acc.icon;
                const isCurrentlyLoading = demoActionLoading === acc.roleId;

                return (
                  <button
                    key={acc.roleId}
                    type="button"
                    onClick={() => handleDemoQuickLogin(acc)}
                    disabled={loading}
                    className={`flex items-center space-x-2.5 p-2.5 rounded-xl bg-slate-900/80 border text-[11px] font-mono transition-all text-left group ${acc.borderStyle}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${acc.textColor} group-hover:scale-110 transition-transform`} />
                    <div className="overflow-hidden">
                      <div className="truncate font-bold text-white text-[10px]">
                        {isCurrentlyLoading ? 'VERIFYING...' : acc.btnLabel}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate font-mono">
                        {acc.email}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
