import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Flame, Car, Cpu, RefreshCw, Zap, MapPin, Radio,
  ArrowRight, Activity, CheckCircle2, Building2, Share2,
  AlertTriangle, Clock, Layers, ChevronRight, Menu, X,
  Compass, Eye, HeartPulse, Sparkles, Navigation, Send
} from 'lucide-react';
import { api } from '../services/api';
import { useCrisisStore } from '../store/useCrisisStore';

interface LandingPageProps {
  navigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ navigate }) => {
  const { user } = useCrisisStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [predictionData, setPredictionData] = useState<any>(null);
  const [replanningActiveStep, setReplanningActiveStep] = useState(0);

  // Fetch actual prediction data from the Prediction Engine
  useEffect(() => {
    let mounted = true;
    api.getPrediction()
      .then((res) => {
        if (mounted && res && res.forecast) {
          setPredictionData(res);
        }
      })
      .catch((err) => {
        console.warn('Prediction API fallback loaded:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-cycle through replanning simulation steps every 4s
  useEffect(() => {
    const timer = setInterval(() => {
      setReplanningActiveStep((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleReportEmergency = () => {
    if (user) {
      if (user.role === 'COMMANDER' || user.role === 'ADMIN' || user.role === 'DISPATCHER') {
        navigate('/commander/dashboard');
      } else if (user.role === 'FIRE_TEAM') {
        navigate('/fire-team/dashboard');
      } else if (user.role === 'HOSPITAL') {
        navigate('/hospital/dashboard');
      } else {
        navigate('/citizen/report');
      }
    } else {
      navigate('/login');
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Prediction metrics from live agent or configured seed values
  const escalationRisk = predictionData?.forecast?.escalation_risk ?? 68.5;
  const escalationLevel = predictionData?.forecast?.escalation_level ?? 'HIGH';
  const responseDelay = predictionData?.forecast?.response_delay_minutes ?? 3.8;
  const hospitalPressure = predictionData?.forecast?.hospital_pressure_percent ?? 54.0;
  const fireDemand = predictionData?.forecast?.resource_demand?.fire_engines_needed ?? 3;
  const ambDemand = predictionData?.forecast?.resource_demand?.ambulances_needed ?? 4;
  const aiExplanation = predictionData?.ai_explanation || 
    'Prediction Model Forecast: Escalation risk evaluated at 68.5%. Multi-incident concurrency on Eastern Expressway and Commercial Sector imposes heavy ALS ambulance demand. Hospital trauma network stable at 54% saturation with 28 reserved triage bays.';

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-x-hidden">
      {/* Background Cinematic Lighting & Ambient Grids */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-cyan-500/10 via-blue-600/5 to-transparent blur-[160px] rounded-full" />
        <div className="absolute top-[800px] right-0 w-[500px] h-[500px] bg-rose-500/5 blur-[150px] rounded-full" />
        <div className="absolute top-[1600px] left-0 w-[600px] h-[600px] bg-cyan-600/5 blur-[160px] rounded-full" />
        {/* Subtle Cyber Grid */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{
            backgroundImage: `linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)`,
            backgroundSize: '48px 48px'
          }} 
        />
      </div>

      {/* ============================================================ */}
      {/* PART 4 — FLOATING GLASS NAVIGATION HEADER                     */}
      {/* ============================================================ */}
      <header className="sticky top-4 z-50 max-w-7xl mx-auto px-4">
        <nav className="glass-panel px-6 py-3.5 rounded-2xl border border-cyan-500/25 shadow-2xl backdrop-blur-xl flex items-center justify-between transition-all">
          {/* Brand */}
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-glow group-hover:scale-105 transition-all">
              <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-display font-extrabold text-lg tracking-wider text-white group-hover:text-cyan-300 transition-colors">
                  CRISIS <span className="text-cyan-400">COMMAND</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-glow">
                  AI NETWORK
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight">Autonomous Emergency Coordination</p>
            </div>
          </div>

          {/* Center Links */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2 font-mono text-xs font-semibold">
            <button
              onClick={() => scrollToSection('hero')}
              className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              HOME
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              HOW IT WORKS
            </button>
            <button
              onClick={() => scrollToSection('ai-system')}
              className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              AI SYSTEM
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
            >
              FEATURES
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center space-x-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/40 transition-all shadow-sm"
            >
              LOGIN
            </button>
            <button
              onClick={() => navigate('/create-account')}
              className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-black bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 transition-all shadow-glow hover:scale-105 active:scale-95"
            >
              CREATE ACCOUNT
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden mt-2 p-4 rounded-2xl bg-[#0b1329]/95 border border-cyan-500/30 backdrop-blur-2xl shadow-2xl space-y-3"
            >
              <button
                onClick={() => scrollToSection('hero')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800"
              >
                HOME
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800"
              >
                HOW IT WORKS
              </button>
              <button
                onClick={() => scrollToSection('ai-system')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800"
              >
                AI SYSTEM
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800"
              >
                FEATURES
              </button>
              <div className="pt-2 border-t border-slate-800 flex flex-col space-y-2">
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                  className="w-full py-2.5 rounded-xl text-center text-xs font-mono font-bold bg-slate-900 border border-slate-700 text-white"
                >
                  LOGIN
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/create-account'); }}
                  className="w-full py-2.5 rounded-xl text-center text-xs font-mono font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-glow"
                >
                  CREATE ACCOUNT
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ============================================================ */}
      {/* PART 5 — LANDING PAGE HERO                                   */}
      {/* ============================================================ */}
      <section id="hero" className="relative pt-16 md:pt-24 pb-20 px-4 z-10">
        <div className="max-w-6xl mx-auto text-center">
          {/* Status Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-[#08152c]/90 border border-cyan-400/40 text-cyan-300 text-xs font-mono mb-8 shadow-glow"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold tracking-wider">● AI RESPONSE NETWORK ONLINE</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">AUTONOMOUS MULTI-AGENT CAD</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-display mb-6 uppercase"
          >
            AI-POWERED <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
              EMERGENCY RESPONSE
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg md:text-2xl text-slate-300 max-w-3xl mx-auto font-light leading-relaxed mb-10"
          >
            Coordinate incidents, resources, routes and emergency response
            in real time with intelligent multi-agent AI.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <button
              onClick={handleReportEmergency}
              className="flex items-center space-x-3 px-8 py-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-mono font-bold text-sm tracking-wide transition-all shadow-glow-red hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Flame className="w-5 h-5 text-white animate-pulse" />
              <span>REPORT EMERGENCY</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => scrollToSection('ai-system')}
              className="flex items-center space-x-3 px-8 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 font-mono font-bold text-sm border border-cyan-500/40 transition-all shadow-glow hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>EXPLORE SYSTEM</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PART 6 — HERO VISUALIZATION (Animated City Grid & Flow)      */}
      {/* ============================================================ */}
      <section className="relative px-4 pb-20 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-hidden backdrop-blur-xl">
            {/* Top Tactical Bar */}
            <div className="flex flex-wrap items-center justify-between pb-6 border-b border-cyan-500/20 gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
                <span className="font-mono font-bold text-xs uppercase tracking-widest text-cyan-300">
                  REAL-TIME DISPATCH CORRIDOR SIMULATION
                </span>
              </div>
              <div className="flex items-center space-x-4 text-[11px] font-mono text-slate-400">
                <span className="flex items-center space-x-1.5 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>2 Active Incidents</span>
                </span>
                <span className="flex items-center space-x-1.5 text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>10 Units Assigned</span>
                </span>
                <span className="flex items-center space-x-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Avg ETA: 4.5m</span>
                </span>
              </div>
            </div>

            {/* Simulated Tactical Map Canvas */}
            <div className="relative h-80 sm:h-96 w-full rounded-2xl my-6 bg-[#040814] border border-cyan-500/20 overflow-hidden flex items-center justify-center">
              {/* Radar Sweep Effect */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[450px] h-[450px] rounded-full border border-cyan-500/15" />
                <div className="w-[300px] h-[300px] rounded-full border border-cyan-500/20" />
                <div className="w-[150px] h-[150px] rounded-full border border-cyan-500/25" />
                <div 
                  className="absolute w-[225px] h-[225px] origin-bottom-right animate-spin"
                  style={{ 
                    animationDuration: '7s',
                    background: 'conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.18) 45deg, transparent 46deg)' 
                  }}
                />
              </div>

              {/* Glowing SVG Connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id="routeGradFire" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <linearGradient id="routeGradAccident" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                {/* Connecting Lines */}
                <line x1="20%" y1="35%" x2="48%" y2="50%" stroke="url(#routeGradFire)" strokeWidth="2.5" strokeDasharray="6,4" />
                <line x1="48%" y1="50%" x2="78%" y2="40%" stroke="#06b6d4" strokeWidth="2.5" strokeDasharray="6,4" />
                <line x1="25%" y1="75%" x2="52%" y2="52%" stroke="url(#routeGradAccident)" strokeWidth="2" strokeDasharray="4,4" />
                <line x1="52%" y1="52%" x2="82%" y2="70%" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4,4" />
              </svg>

              {/* Node 1: Fire Incident */}
              <motion.div 
                animate={{ scale: [1, 1.08, 1] }} 
                transition={{ duration: 2.2, repeat: Infinity }}
                className="absolute top-[32%] left-[16%] flex flex-col items-center z-10"
              >
                <div className="p-3 rounded-2xl bg-rose-600/30 border border-rose-400 text-rose-300 shadow-glow-red backdrop-blur-md">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>
                <div className="mt-1 px-2 py-0.5 rounded bg-black/80 border border-rose-500/40 text-[10px] font-mono text-rose-300 font-bold">
                  FIRE #001 (HIGH)
                </div>
              </motion.div>

              {/* Node 2: Assessment & Routing Engine */}
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }} 
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute top-[45%] left-[45%] flex flex-col items-center z-10"
              >
                <div className="p-3.5 rounded-2xl bg-cyan-600/30 border border-cyan-400 text-cyan-300 shadow-glow backdrop-blur-md">
                  <Cpu className="w-7 h-7 animate-spin" style={{ animationDuration: '10s' }} />
                </div>
                <div className="mt-1 px-2.5 py-0.5 rounded bg-black/80 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-bold">
                  MULTI-AGENT AI DISPATCH
                </div>
              </motion.div>

              {/* Node 3: Fire Station Alpha + Ambulance 01 */}
              <motion.div 
                animate={{ scale: [1, 1.06, 1] }} 
                transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                className="absolute top-[34%] right-[18%] flex flex-col items-center z-10"
              >
                <div className="p-3 rounded-2xl bg-blue-600/30 border border-blue-400 text-blue-300 shadow-glow backdrop-blur-md">
                  <Navigation className="w-6 h-6" />
                </div>
                <div className="mt-1 px-2 py-0.5 rounded bg-black/80 border border-blue-500/40 text-[10px] font-mono text-blue-300 font-bold">
                  FIRE RESCUE + ALS AMB (ETA 4.5m)
                </div>
              </motion.div>

              {/* Node 4: Road Accident Incident */}
              <div className="absolute bottom-[20%] left-[22%] flex flex-col items-center z-10">
                <div className="p-2.5 rounded-xl bg-amber-500/25 border border-amber-400 text-amber-300 shadow-glow">
                  <Car className="w-5 h-5" />
                </div>
                <div className="mt-1 px-2 py-0.5 rounded bg-black/80 border border-amber-500/40 text-[9px] font-mono text-amber-300">
                  CRASH #002 (MED)
                </div>
              </div>

              {/* Node 5: Hospital Destination */}
              <div className="absolute bottom-[18%] right-[15%] flex flex-col items-center z-10">
                <div className="p-2.5 rounded-xl bg-emerald-500/25 border border-emerald-400 text-emerald-300 shadow-glow-emerald">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="mt-1 px-2 py-0.5 rounded bg-black/80 border border-emerald-500/40 text-[9px] font-mono text-emerald-300">
                  METRO GENERAL HOSPITAL
                </div>
              </div>
            </div>

            {/* Visual Process Flow (Part 6 Requirement) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center pt-2">
              {[
                { label: 'FIRE INCIDENT', sub: 'Citizen / CCTV Intake', color: 'text-rose-400' },
                { label: 'ASSESSMENT AI', sub: 'Triage & Severity Classification', color: 'text-cyan-400' },
                { label: 'FIRE TEAM + EMS', sub: 'Autonomous Proximity Match', color: 'text-blue-400' },
                { label: 'HOSPITAL', sub: 'Trauma Bay Capacity Check', color: 'text-emerald-400' },
                { label: 'LIVE ROUTE', sub: 'Dynamic Siren Corridors', color: 'text-amber-400' },
                { label: 'RESPONSE COMPLETE', sub: 'Continuous Self-Healing', color: 'text-purple-400' },
              ].map((step, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500">PHASE 0{idx + 1}</div>
                  <div className={`text-xs font-mono font-bold mt-1 ${step.color}`}>{step.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{step.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PART 7 — GLASS FEATURE SECTION (6 Cards)                     */}
      {/* ============================================================ */}
      <section id="features" className="py-20 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30">
              NEXT-GENERATION EMERGENCY CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-white mt-4">
              Autonomous Operations For Every Critical Second
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm mt-2">
              Engineered to replace slow manual phone trees with instant mathematical optimization and cognitive AI reasoning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* CARD 1 */}
            <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 mb-5 shadow-glow-red group-hover:scale-110 transition-transform">
                <Flame className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-mono text-white mb-2">AI INCIDENT ASSESSMENT</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Automatically understand fire and road-accident incidents and determine severity, urgency and resource requirements.
              </p>
            </div>

            {/* CARD 2 */}
            <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 mb-5 shadow-glow group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-mono text-white mb-2">SMART RESOURCE ALLOCATION</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Automatically identify suitable emergency resources using: availability, distance, ETA, capacity, specialization, and current assignment.
              </p>
            </div>

            {/* CARD 3 */}
            <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-400 mb-5 shadow-glow group-hover:scale-110 transition-transform">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-mono text-white mb-2">DYNAMIC REPLANNING</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Automatically generate a new response plan when: new incident arrives, resource becomes unavailable, severity changes, resource requirements change, route changes, or conflict occurs.
              </p>
            </div>

            {/* CARD 4 */}
            <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mb-5 shadow-glow group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-mono text-white mb-2">PREDICTIVE RESPONSE</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Predict: escalation risk, resource demand, possible resource shortages, response delay, hospital capacity pressure, and potential priority changes.
              </p>
            </div>

            {/* CARD 5 */}
            <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 mb-5 shadow-glow group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-mono text-white mb-2">LIVE COMMAND CENTER</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Real-time monitoring of: incidents, resources, routes, plans, AI activity, notifications, and chronological event timeline.
              </p>
            </div>

            {/* CARD 6 */}
            <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 mb-5 shadow-glow-emerald group-hover:scale-110 transition-transform">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold font-mono text-white mb-2">UNIVERSAL DEVICE SHARING</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Allow users to share emergency information using the device's native share mechanism. Zero external API credentials required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PART 8 — MULTI-AGENT AI SECTION (Connected Glass Nodes)     */}
      {/* ============================================================ */}
      <section id="ai-system" className="py-20 px-4 bg-[#070c1b]/80 border-y border-cyan-500/20 relative z-10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30">
              ARCHITECTURE & REASONING
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-white mt-4">
              Autonomous Multi-Agent AI Architecture
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm mt-2">
              Connected specialized intelligence nodes executing with deterministic validation guardrails.
            </p>
          </div>

          {/* Connected Agent Pipeline Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { title: 'INCIDENT INTAKE', desc: 'Citizen GPS or CCTV Signal', icon: Flame, color: 'border-rose-500/40 text-rose-300' },
              { title: 'INCIDENT ASSESSMENT AI', desc: 'Synthesizes Triage & Severity', icon: Cpu, color: 'border-cyan-500/40 text-cyan-300' },
              { title: 'FIRE / ACCIDENT AI', desc: 'Domain-specific Hazmat/Extrication', icon: AlertTriangle, color: 'border-amber-500/40 text-amber-300' },
              { title: 'PREDICTION AI', desc: 'Escalation & Capacity Forecasting', icon: Clock, color: 'border-indigo-500/40 text-indigo-300' },
              { title: 'RESOURCE ALLOCATION', desc: 'Proximity & Capacity Scoring', icon: Activity, color: 'border-blue-500/40 text-blue-300' },
              { title: 'ROUTE / LOGISTICS AI', desc: 'Turn-by-turn ETA & Corridors', icon: Navigation, color: 'border-sky-500/40 text-sky-300' },
              { title: 'COMMAND PLANNER', desc: 'Synthesizes Response Plan V1', icon: Shield, color: 'border-cyan-500/40 text-cyan-300' },
              { title: 'REPLAN ENGINE', desc: 'Watches for State Invalidation', icon: RefreshCw, color: 'border-purple-500/40 text-purple-300' },
              { title: 'VALIDATION ENGINE', desc: 'Deterministic Safety Rules', icon: CheckCircle2, color: 'border-emerald-500/40 text-emerald-300' },
              { title: 'AUTOMATIC RESPONSE', desc: 'Instant Dispatch Without Latency', icon: Zap, color: 'border-rose-400/40 text-rose-300' },
            ].map((node, idx) => {
              const Icon = node.icon;
              return (
                <div
                  key={idx}
                  className="glass-card p-4 rounded-2xl border hover:border-cyan-400/70 transition-all duration-300 relative group flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-slate-500">NODE 0{idx + 1}</span>
                    <Icon className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <h4 className="font-mono font-bold text-xs text-white leading-tight">{node.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{node.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PART 9 — PREDICTION ENGINE (Live Gauges & AI Explanation)   */}
      {/* ============================================================ */}
      <section id="how-it-works" className="py-20 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30">
              PREDICTIVE INTELLIGENCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-white mt-4">
              Real-Time Emergency Prediction Engine
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm mt-2">
              Continuous forecasting prevents emergency bottlenecks before first responders arrive.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Metric 1: Escalation Risk */}
            <div className="glass-panel p-5 rounded-2xl border border-rose-500/30">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                <span>ESCALATION RISK</span>
                <span className="text-rose-400 font-bold">{escalationLevel}</span>
              </div>
              <div className="text-3xl font-mono font-extrabold text-white">{escalationRisk}%</div>
              <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-rose-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${escalationRisk}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-3 font-mono">
                Evaluates weather, structural materials, entrapment, and spread vectors.
              </p>
            </div>

            {/* Metric 2: Resource Demand */}
            <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                <span>RESOURCE DEMAND</span>
                <span className="text-cyan-400 font-bold">PROJECTED</span>
              </div>
              <div className="text-3xl font-mono font-extrabold text-white">
                {fireDemand + ambDemand} <span className="text-xs text-slate-400 font-normal">UNITS</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono mt-3">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {fireDemand} Engines
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {ambDemand} Ambulances
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 font-mono">
                Fleet optimization based on casualties and fire perimeter calculations.
              </p>
            </div>

            {/* Metric 3: Response Delay */}
            <div className="glass-panel p-5 rounded-2xl border border-amber-500/30">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                <span>RESPONSE DELAY</span>
                <span className="text-amber-400 font-bold">TRANSIT</span>
              </div>
              <div className="text-3xl font-mono font-extrabold text-white">
                {responseDelay} <span className="text-xs text-slate-400 font-normal">MINUTES</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-amber-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(responseDelay * 12, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-3 font-mono">
                Projected travel delay across city corridors with automated green light signals.
              </p>
            </div>

            {/* Metric 4: Hospital Pressure */}
            <div className="glass-panel p-5 rounded-2xl border border-blue-500/30">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                <span>HOSPITAL PRESSURE</span>
                <span className="text-blue-400 font-bold">CAPACITY</span>
              </div>
              <div className="text-3xl font-mono font-extrabold text-white">{hospitalPressure}%</div>
              <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${hospitalPressure}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-3 font-mono">
                Trauma bay availability and burn ICU bed occupancy across regional hospitals.
              </p>
            </div>
          </div>

          {/* AI Explanation Box (Part 9 Architecture Requirement) */}
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 mt-6 backdrop-blur-xl">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-xs text-cyan-300 uppercase">AI PREDICTION EXPLANATION</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    CURRENT STATE → MODEL → FORECAST → EXPLANATION
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-2 font-mono leading-relaxed">
                  {aiExplanation}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PART 10 — DYNAMIC REPLANNING VISUALIZATION                   */}
      {/* ============================================================ */}
      <section className="py-20 px-4 bg-[#070c1b]/60 border-t border-cyan-500/20 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30">
              SELF-HEALING INCIDENT COORDINATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-white mt-4">
              Dynamic Replanning (Plan V1 → Plan V2)
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm mt-2">
              "Response plans continuously adapt to the current emergency state."
            </p>
          </div>

          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-purple-500/30 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Step Progression Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[
                {
                  title: 'PLAN V1 ACTIVE',
                  desc: 'Ambulance 01 → Accident A\nFire Team 02 → Fire B',
                  status: 'DISPATCHED',
                  badge: 'Plan V1',
                  color: 'border-cyan-500/40 text-cyan-300',
                },
                {
                  title: 'CHANGE DETECTED',
                  desc: 'New Critical Incident Occurred +\nAmbulance 01 Mechanical Breakdown',
                  status: 'ALERT TRIGGERED',
                  badge: 'Event',
                  color: 'border-rose-500/40 text-rose-300',
                },
                {
                  title: 'AI REASSESSMENT',
                  desc: 'Constraint Solver Recalculates Proximity & Bed Saturation',
                  status: 'OPTIMIZING',
                  badge: 'Engine',
                  color: 'border-amber-500/40 text-amber-300',
                },
                {
                  title: 'PLAN V2 EXECUTED',
                  desc: 'Ambulance 03 Re-routed to Critical\nZero Approval Blocking Popups',
                  status: 'AUTO-ACTIVATED',
                  badge: 'Plan V2',
                  color: 'border-emerald-500/40 text-emerald-300',
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  onClick={() => setReplanningActiveStep(idx)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    replanningActiveStep === idx
                      ? 'bg-purple-950/40 border-purple-400 shadow-glow scale-[1.02]'
                      : 'bg-slate-900/50 border-slate-800 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 border border-slate-700 text-slate-300">
                      {step.badge}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${step.color}`}>{step.status}</span>
                  </div>
                  <h4 className="font-mono font-bold text-xs text-white">{step.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 whitespace-pre-line leading-relaxed font-mono">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Replanning Explanation Card */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center space-x-2 text-purple-300">
                <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: '8s' }} />
                <span className="font-bold">Transparent Replan Rationale:</span>
                <span className="text-slate-300">
                  "Ambulance 01 unavailable due to blowout. Re-optimized nearest available Ambulance 03 (ETA 5.1m). Plan V2 activated."
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-200 border border-purple-400/40 font-bold">
                LATENCY: 180ms
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PART 11 — FINAL LANDING PAGE CTA                             */}
      {/* ============================================================ */}
      <section className="py-24 px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center glass-panel p-10 md:p-14 rounded-3xl border border-cyan-500/30 shadow-[0_0_60px_rgba(6,182,212,0.18)] backdrop-blur-2xl">
          <h2 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-white mb-4 uppercase">
            READY FOR INTELLIGENT <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-rose-400">
              EMERGENCY RESPONSE?
            </span>
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-8 font-light">
            Deploy the autonomous emergency coordination network. Multi-agent dispatch, proximity routing, and self-healing response plans.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate('/create-account')}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-mono font-bold text-xs tracking-wider transition-all shadow-glow hover:scale-105 active:scale-95"
            >
              CREATE ACCOUNT
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white font-mono font-bold text-xs tracking-wider border border-slate-700 hover:border-cyan-500/40 transition-all shadow-sm hover:scale-105 active:scale-95"
            >
              LOGIN
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PART 12 — FOOTER (Public Links Only)                         */}
      {/* ============================================================ */}
      <footer className="py-12 px-4 border-t border-cyan-500/20 bg-[#040814] relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <span className="font-display font-bold text-base text-white tracking-wider">CRISIS COMMAND</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">AI PLATFORM</span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">AI-POWERED EMERGENCY RESPONSE</p>
          </div>

          {/* Public Links Only (Part 12 Rule: No internal links) */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-400">
            <button onClick={() => scrollToSection('hero')} className="hover:text-cyan-300 transition-colors">Home</button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-cyan-300 transition-colors">How It Works</button>
            <button onClick={() => scrollToSection('ai-system')} className="hover:text-cyan-300 transition-colors">AI System</button>
            <button onClick={() => scrollToSection('features')} className="hover:text-cyan-300 transition-colors">Features</button>
            <button onClick={() => navigate('/login')} className="hover:text-cyan-300 transition-colors">Login</button>
            <button onClick={() => navigate('/create-account')} className="hover:text-cyan-300 transition-colors">Create Account</button>
          </div>

          <div className="text-xs text-slate-500 font-mono text-center md:text-right">
            © 2026 Crisis Command. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
