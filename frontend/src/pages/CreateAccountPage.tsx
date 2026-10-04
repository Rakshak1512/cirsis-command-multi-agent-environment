import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle,
  ArrowLeft, Eye, EyeOff, Shield, Flame, Hospital, Navigation,
  Phone, MapPin, Activity, Stethoscope, Truck, KeyRound
} from 'lucide-react';
import { api, normalizeApiError } from '../services/api';
import { useCrisisStore } from '../store/useCrisisStore';

interface CreateAccountPageProps {
  navigate: (path: string) => void;
}

type AccountType = 'CITIZEN' | 'FIRE_TEAM' | 'HOSPITAL' | 'ADMIN';

export const CreateAccountPage: React.FC<CreateAccountPageProps> = ({ navigate }) => {
  const [selectedRole, setSelectedRole] = useState<AccountType | null>(null);
  const [step, setStep] = useState<'SELECT_ROLE' | 'FORM' | 'OTP'>('SELECT_ROLE');

  // Common Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Fire Team Specific Fields
  const [stationName, setStationName] = useState('');
  const [teamLeaderName, setTeamLeaderName] = useState('');
  const [stationAddress, setStationAddress] = useState('88 Industrial Sector Way');
  const [contactInfo, setContactInfo] = useState('+1-555-0199');
  const [teamCapacity, setTeamCapacity] = useState(4);
  const [equipmentList, setEquipmentList] = useState('Heavy Engine, Hydraulic Extricator, Hazmat Foam, Ladder Unit');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Hospital Specific Fields
  const [hospitalName, setHospitalName] = useState('');
  const [adminContactName, setAdminContactName] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('120 Health Sciences Blvd');
  const [emergencyContact, setEmergencyContact] = useState('+1-555-0433');
  const [availableBeds, setAvailableBeds] = useState(14);
  const [icuBeds, setIcuBeds] = useState(6);
  const [emergencyCapacity, setEmergencyCapacity] = useState(25);
  const [ambulanceCapacity, setAmbulanceCapacity] = useState(4);
  const [specializations, setSpecializations] = useState('Level-1 Trauma, Burn Unit, Neurosurgery, Cardiac ICU');

  // Admin Specific Fields
  const [organization, setOrganization] = useState('Crisis Command Directorate');
  const [adminCode, setAdminCode] = useState('CRISIS-ADMIN-2026');

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Expiry & Cooldown Timers
  const [countdown, setCountdown] = useState(300); // 5 minutes expiry
  const [resendCooldown, setResendCooldown] = useState(60);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { setUser } = useCrisisStore();

  useEffect(() => {
    let timer: any;
    if (step === 'OTP' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((c) => (c > 0 ? c - 1 : 0));
        setResendCooldown((r) => (r > 0 ? r - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // GPS Coordinate Acquisition Helper — always acquires fresh device GPS (maximumAge: 0)
  const handleAcquireGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        (err) => console.warn('GPS lookup notice:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Auto-acquire GPS when fire team or hospital registration form is shown
  const handleSelectRole = (role: AccountType) => {
    setSelectedRole(role);
    setStep('FORM');
    setError(null);
    if (role === 'FIRE_TEAM' || role === 'HOSPITAL') {
      handleAcquireGPS();
    }
  };

  const handleBackToRoles = () => {
    setStep('SELECT_ROLE');
    setSelectedRole(null);
    setError(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        email: email.trim().toLowerCase(),
        password,
        role: selectedRole,
      };

      if (selectedRole === 'CITIZEN') {
        payload.full_name = fullName;
      } else if (selectedRole === 'FIRE_TEAM') {
        payload.full_name = teamLeaderName || stationName;
        payload.station_name = stationName;
        payload.team_leader_name = teamLeaderName;
        payload.location_address = stationAddress;
        payload.contact = contactInfo;
        payload.emergency_capacity = Number(teamCapacity);
        payload.equipment = equipmentList.split(',').map((s) => s.trim()).filter(Boolean);
        payload.latitude = lat ?? 0;
        payload.longitude = lng ?? 0;
      } else if (selectedRole === 'HOSPITAL') {
        payload.full_name = adminContactName || hospitalName;
        payload.hospital_name = hospitalName;
        payload.location_address = hospitalAddress;
        payload.contact = emergencyContact;
        payload.available_beds = Number(availableBeds);
        payload.icu_beds = Number(icuBeds);
        payload.emergency_capacity = Number(emergencyCapacity);
        payload.ambulance_capacity = Number(ambulanceCapacity);
        payload.specializations = specializations.split(',').map((s) => s.trim()).filter(Boolean);
        payload.latitude = lat ?? 0;
        payload.longitude = lng ?? 0;
      } else if (selectedRole === 'ADMIN') {
        payload.full_name = fullName;
        payload.organization = organization;
        payload.admin_code = adminCode;
      }

      await api.register(payload);

      setStep('OTP');
      setCountdown(300);
      setResendCooldown(60);
      setAttempts(0);
      setInfoNotice(`6-digit verification code dispatched to ${email.trim().toLowerCase()}`);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = otpDigits.join('');

    if (enteredOtp.length < 6) {
      setError('Please enter all 6 digits of the OTP.');
      return;
    }

    if (attempts >= 5) {
      setError('Maximum OTP attempts reached. Please request a new code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await api.verifyOtp(email.trim().toLowerCase(), enteredOtp);
      setUser(res.user, res.access_token);

      // Section 3 & 20: Redirect automatically to the verified role dashboard
      const userRole = res.user?.role;
      if (userRole === 'FIRE_TEAM') {
        navigate('/fire-team/dashboard');
      } else if (userRole === 'HOSPITAL') {
        navigate('/hospital/dashboard');
      } else if (userRole === 'ADMIN' || userRole === 'COMMANDER' || userRole === 'DISPATCHER') {
        navigate('/commander/dashboard');
      } else {
        navigate('/citizen/dashboard');
      }
    } catch (err: any) {
      setAttempts((a) => a + 1);
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setInfoNotice(null);
    setLoading(true);
    try {
      await api.register({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName || stationName || hospitalName || 'Responder',
        role: selectedRole || 'CITIZEN',
      });
      setResendCooldown(60);
      setCountdown(300);
      setOtpDigits(['', '', '', '', '', '']);
      setInfoNotice('A fresh 6-digit verification code has been dispatched to your email.');
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-[#050811] text-white flex flex-col justify-center p-4 relative py-12 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background cinematic glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[550px] bg-cyan-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Back button */}
      <div className="max-w-4xl w-full mx-auto mb-6 z-10">
        <button
          onClick={() => {
            if (step === 'FORM') handleBackToRoles();
            else if (step === 'OTP') setStep('FORM');
            else navigate('/');
          }}
          className="inline-flex items-center space-x-2 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>
            {step === 'FORM'
              ? 'BACK TO ACCOUNT TYPES'
              : step === 'OTP'
              ? 'BACK TO REGISTRATION FORM'
              : 'BACK TO CRISIS COMMAND'}
          </span>
        </button>
      </div>

      <div className="max-w-4xl w-full mx-auto z-10">
        {/* ============================================================ */}
        {/* STEP 1: ACCOUNT TYPE SELECTION (4 PREMIUM GLASS CARDS)        */}
        {/* ============================================================ */}
        {step === 'SELECT_ROLE' && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-white uppercase">
                CREATE YOUR CRISIS COMMAND ACCOUNT
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-mono max-w-xl mx-auto">
                Choose your account type to join the Crisis Command emergency response network.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* CARD 1: CITIZEN */}
              <div
                onClick={() => handleSelectRole('CITIZEN')}
                className="glass-panel p-6 sm:p-7 rounded-3xl border border-emerald-500/30 hover:border-emerald-400/70 bg-[#080d1e]/80 shadow-[0_0_40px_rgba(16,185,129,0.12)] transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform shadow-glow-emerald">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold font-display text-white mb-2">CITIZEN</h3>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    Report emergencies and track your own emergency response.
                  </p>
                </div>
                <div className="pt-6">
                  <button
                    type="button"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold font-mono tracking-wider text-xs transition-all shadow-glow-emerald flex items-center justify-center space-x-2"
                  >
                    <span>CREATE CITIZEN ACCOUNT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* CARD 2: FIRE TEAM */}
              <div
                onClick={() => handleSelectRole('FIRE_TEAM')}
                className="glass-panel p-6 sm:p-7 rounded-3xl border border-rose-500/30 hover:border-rose-400/70 bg-[#080d1e]/80 shadow-[0_0_40px_rgba(244,63,94,0.12)] transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition-transform shadow-glow-red">
                    <Flame className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold font-display text-white mb-2">FIRE TEAM</h3>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    Register your emergency response team and manage assigned fire incidents.
                  </p>
                </div>
                <div className="pt-6">
                  <button
                    type="button"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-400 hover:to-red-400 text-white font-bold font-mono tracking-wider text-xs transition-all shadow-glow-red flex items-center justify-center space-x-2"
                  >
                    <span>CREATE FIRE TEAM ACCOUNT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* CARD 3: HOSPITAL */}
              <div
                onClick={() => handleSelectRole('HOSPITAL')}
                className="glass-panel p-6 sm:p-7 rounded-3xl border border-cyan-500/30 hover:border-cyan-400/70 bg-[#080d1e]/80 shadow-[0_0_40px_rgba(6,182,212,0.12)] transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 mb-4 group-hover:scale-110 transition-transform shadow-glow">
                    <Hospital className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold font-display text-white mb-2">HOSPITAL</h3>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    Register your hospital and manage emergency capacity, ambulance intake and incoming incidents.
                  </p>
                </div>
                <div className="pt-6">
                  <button
                    type="button"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold font-mono tracking-wider text-xs transition-all shadow-glow flex items-center justify-center space-x-2"
                  >
                    <span>CREATE HOSPITAL ACCOUNT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* CARD 4: ADMIN */}
              <div
                onClick={() => handleSelectRole('ADMIN')}
                className="glass-panel p-6 sm:p-7 rounded-3xl border border-purple-500/30 hover:border-purple-400/70 bg-[#080d1e]/80 shadow-[0_0_40px_rgba(168,85,247,0.12)] transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform shadow-glow">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold font-display text-white mb-2">ADMIN</h3>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    Create an administrative account for managing the Crisis Command platform.
                  </p>
                </div>
                <div className="pt-6">
                  <button
                    type="button"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold font-mono tracking-wider text-xs transition-all shadow-glow flex items-center justify-center space-x-2"
                  >
                    <span>CREATE ADMIN ACCOUNT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <span className="text-xs font-mono text-slate-400">Already have an account? </span>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs font-mono text-cyan-400 font-bold hover:underline"
              >
                LOGIN
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: ROLE-SPECIFIC REGISTRATION FORM                      */}
        {/* ============================================================ */}
        {step === 'FORM' && selectedRole && (
          <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.12)] backdrop-blur-2xl max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-1 pb-2 border-b border-slate-800">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/30 text-cyan-300 text-xs font-mono mb-2">
                <span>{selectedRole} ENROLLMENT</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white uppercase">
                {selectedRole === 'CITIZEN' && 'CITIZEN REGISTRATION'}
                {selectedRole === 'FIRE_TEAM' && 'FIRE TEAM REGISTRATION'}
                {selectedRole === 'HOSPITAL' && 'HOSPITAL REGISTRATION'}
                {selectedRole === 'ADMIN' && 'ADMINISTRATIVE REGISTRATION'}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {selectedRole === 'CITIZEN' && 'Enroll to report emergencies and track autonomous first responders.'}
                {selectedRole === 'FIRE_TEAM' && 'Register your station and response engines for automatic dispatch.'}
                {selectedRole === 'HOSPITAL' && 'Register your emergency medical facility and live trauma capacity.'}
                {selectedRole === 'ADMIN' && 'Provision platform administration credentials.'}
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2.5 font-mono"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              {/* --- CITIZEN FIELDS --- */}
              {selectedRole === 'CITIZEN' && (
                <>
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Alex Mercer"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="resident@crisiscommand.org"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* --- FIRE TEAM FIELDS --- */}
              {selectedRole === 'FIRE_TEAM' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Team / Station Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Central Fire Station Alpha"
                        value={stationName}
                        onChange={(e) => setStationName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Team Leader Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Captain Robert Davis"
                        value={teamLeaderName}
                        onChange={(e) => setTeamLeaderName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Official Email</label>
                      <input
                        type="email"
                        required
                        placeholder="station01@crisiscommand.demo"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Contact Phone</label>
                      <input
                        type="text"
                        required
                        placeholder="+1-555-0101"
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Station Address</label>
                    <input
                      type="text"
                      required
                      placeholder="104 MG Road Fire Depot"
                      value={stationAddress}
                      onChange={(e) => setStationAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Ready Engines Capacity</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        required
                        value={teamCapacity}
                        onChange={(e) => setTeamCapacity(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-mono text-slate-300">Station Coordinates</label>
                        <button
                          type="button"
                          onClick={handleAcquireGPS}
                          className="text-[10px] font-mono text-cyan-400 hover:underline"
                        >
                          Use Device GPS
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="any"
                          value={lat ?? ''}
                          onChange={(e) => setLat(e.target.value ? parseFloat(e.target.value) : null)}
                          className="px-2.5 py-2 rounded-xl bg-black/60 border border-slate-700 text-white text-xs font-mono"
                          placeholder="Lat"
                        />
                        <input
                          type="number"
                          step="any"
                          value={lng ?? ''}
                          onChange={(e) => setLng(e.target.value ? parseFloat(e.target.value) : null)}
                          className="px-2.5 py-2 rounded-xl bg-black/60 border border-slate-700 text-white text-xs font-mono"
                          placeholder="Lng"
                        />
                      </div>
                      {lat !== null && lng !== null && (
                        <div className="text-[10px] font-mono text-emerald-400 mt-1">
                          📍 GPS: ({lat.toFixed(5)}, {lng.toFixed(5)})
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Emergency Equipment (Comma-separated)</label>
                    <input
                      type="text"
                      placeholder="Heavy Engine 01, Ladder Truck, Hydraulic Extricator"
                      value={equipmentList}
                      onChange={(e) => setEquipmentList(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                    />
                  </div>
                </>
              )}

              {/* --- HOSPITAL FIELDS --- */}
              {selectedRole === 'HOSPITAL' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Hospital Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Metro Central General Hospital"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Administrator / Contact Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Dr. Sarah Jenkins"
                        value={adminContactName}
                        onChange={(e) => setAdminContactName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Official Email</label>
                      <input
                        type="email"
                        required
                        placeholder="trauma@crisiscommand.demo"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1.5">Emergency Contact Line</label>
                      <input
                        type="text"
                        required
                        placeholder="+1-555-0433"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Hospital Address</label>
                    <input
                      type="text"
                      required
                      placeholder="500 Victoria Hospital Way"
                      value={hospitalAddress}
                      onChange={(e) => setHospitalAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-mono text-slate-300">Hospital Coordinates (GPS)</label>
                      <button
                        type="button"
                        onClick={handleAcquireGPS}
                        className="text-[10px] font-mono text-cyan-400 hover:underline"
                      >
                        Use Device GPS
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        value={lat ?? ''}
                        onChange={(e) => setLat(e.target.value ? parseFloat(e.target.value) : null)}
                        className="px-2.5 py-2 rounded-xl bg-black/60 border border-slate-700 text-white text-xs font-mono"
                        placeholder="Lat"
                      />
                      <input
                        type="number"
                        step="any"
                        value={lng ?? ''}
                        onChange={(e) => setLng(e.target.value ? parseFloat(e.target.value) : null)}
                        className="px-2.5 py-2 rounded-xl bg-black/60 border border-slate-700 text-white text-xs font-mono"
                        placeholder="Lng"
                      />
                    </div>
                    {lat !== null && lng !== null && (
                      <div className="text-[10px] font-mono text-emerald-400 mt-1">
                        📍 GPS: ({lat.toFixed(5)}, {lng.toFixed(5)})
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Available Beds</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={availableBeds}
                        onChange={(e) => setAvailableBeds(Number(e.target.value))}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">ICU Beds</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={icuBeds}
                        onChange={(e) => setIcuBeds(Number(e.target.value))}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Emergency Cap.</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={emergencyCapacity}
                        onChange={(e) => setEmergencyCapacity(Number(e.target.value))}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Ambulances</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={ambulanceCapacity}
                        onChange={(e) => setAmbulanceCapacity(Number(e.target.value))}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Medical Specializations</label>
                    <input
                      type="text"
                      placeholder="Level-1 Trauma, Burn Unit, Neurosurgery, Cardiac ICU"
                      value={specializations}
                      onChange={(e) => setSpecializations(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                    />
                  </div>
                </>
              )}

              {/* --- ADMIN FIELDS --- */}
              {selectedRole === 'ADMIN' && (
                <>
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Full Administrator Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="Marcus Vance"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Official Administrative Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="admin@crisiscommand.org"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">Organization / Department</label>
                    <input
                      type="text"
                      required
                      placeholder="Crisis Command Directorate"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5">
                      Administrative Registration Code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-purple-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="CRISIS-ADMIN-2026"
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-purple-500/40 text-purple-200 text-xs font-mono placeholder-slate-500 focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                      Protected authorization required. Demo passcode: <strong>CRISIS-ADMIN-2026</strong>
                    </span>
                  </div>
                </>
              )}

              {/* Password Fields for all roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold font-mono tracking-wider text-xs transition-all shadow-glow flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98]"
              >
                <span>{loading ? 'SENDING EMAIL OTP...' : `CREATE ${selectedRole} ACCOUNT`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: 6-DIGIT OTP VERIFICATION                             */}
        {/* ============================================================ */}
        {step === 'OTP' && (
          <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.12)] backdrop-blur-2xl max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white uppercase">
                VERIFY OTP
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Enter the 6-digit verification code dispatched to <span className="text-cyan-300">{email}</span>
              </p>
            </div>

            {infoNotice && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-start space-x-2.5 font-mono"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{infoNotice}</span>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2.5 font-mono"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-center">
                <Mail className="w-8 h-8 text-cyan-400 mx-auto mb-2 animate-bounce" />
                <div className="text-xs font-mono text-cyan-300 font-bold uppercase tracking-wider">
                  ENTER 6-DIGIT VERIFICATION CODE
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">
                  Code expires in: <span className="text-cyan-300 font-bold">{formatTime(countdown)}</span>
                </p>
                {countdown === 0 && (
                  <p className="text-xs text-amber-400 font-mono mt-2 font-semibold">
                    Code has expired. Click &ldquo;Resend Code&rdquo; below to request a new OTP.
                  </p>
                )}
              </div>

              {/* 6 Separate Animated Input Boxes */}
              <div className="flex justify-center items-center space-x-2 sm:space-x-3">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-mono font-bold rounded-xl bg-slate-900 border-2 border-cyan-500/40 focus:border-cyan-300 text-cyan-300 focus:outline-none shadow-glow transition-all"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('FORM')}
                  className="hover:text-white transition-colors"
                >
                  Edit Details
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || otpDigits.join('').length < 6 || countdown === 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-black font-bold font-mono tracking-wider text-xs transition-all shadow-glow-emerald flex items-center justify-center space-x-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'VERIFYING...' : 'VERIFY OTP & ACTIVATE ACCOUNT'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
