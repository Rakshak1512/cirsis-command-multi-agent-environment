import React, { useEffect, useState } from 'react';
import { useCrisisStore } from './store/useCrisisStore';
import { Navbar } from './components/common/Navbar';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { CreateAccountPage } from './pages/CreateAccountPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { CitizenDashboard } from './pages/CitizenDashboard';
import { CitizenIncidentPage } from './pages/CitizenIncidentPage';
import { CommanderDashboard } from './pages/CommanderDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { FireTeamDashboard } from './pages/FireTeamDashboard';
import { HospitalDashboard } from './pages/HospitalDashboard';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AlertCircle, X, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('App runtime error caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold font-mono text-white tracking-wider">SYSTEM RECOVERY</h2>
          <p className="text-xs font-mono text-slate-400 max-w-md">
            An unexpected client render state was encountered: {this.state.error?.message || 'Error initializing view'}.
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-5 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-xs font-mono font-bold hover:bg-cyan-500/30 transition-all shadow-glow"
            >
              RELOAD PAGE
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/login'; }}
              className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold hover:bg-slate-800 transition-all"
            >
              LOGIN SCREEN
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');
  const { user, fetchInitialData, initWebSocket, liveBanner, clearLiveBanner } = useCrisisStore();

  useEffect(() => {
    fetchInitialData();
    initWebSocket();

    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const checkRoleAccess = (requiredRolePrefix: string): boolean => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    if (role === 'admin' || role === 'commander' || role === 'dispatcher') return true;
    if (requiredRolePrefix === 'citizen' && role === 'citizen') return true;
    if (requiredRolePrefix === 'fire_team' && (role === 'fire_team' || role.includes('fire'))) return true;
    if (requiredRolePrefix === 'hospital' && (role === 'hospital' || role.includes('hosp'))) return true;
    return false;
  };

  const getRoleDashboard = (userRole?: string) => {
    const r = (userRole || '').toLowerCase();
    if (r.includes('fire')) return '/fire-team/dashboard';
    if (r.includes('hosp')) return '/hospital/dashboard';
    if (r.includes('admin') || r.includes('command') || r.includes('dispatch')) return '/commander/dashboard';
    return '/citizen/dashboard';
  };

  const renderAccessDenied = (targetArea: string) => (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold font-mono text-white tracking-wider">ACCESS RESTRICTED</h2>
      <p className="text-xs font-mono text-slate-400 max-w-md">
        Your authenticated role ({user?.role || 'Unauthenticated'}) is not authorized to access the {targetArea} interface.
      </p>
      <button
        onClick={() => navigate(user ? getRoleDashboard(user.role) : '/login')}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-xs font-mono font-bold hover:scale-105 transition-all shadow-glow"
      >
        {user ? 'RETURN TO MY AUTHORIZED DASHBOARD' : 'PROCEED TO SECURE LOGIN'}
      </button>
    </div>
  );

  const renderPage = () => {
    // Exact route matching & prefix matching
    if (currentPath === '/') {
      return <LandingPage navigate={navigate} />;
    }
    if (currentPath === '/login') {
      return <LoginPage navigate={navigate} />;
    }
    if (currentPath === '/create-account') {
      return <CreateAccountPage navigate={navigate} />;
    }
    if (currentPath === '/forgot-password') {
      return <ForgotPasswordPage navigate={navigate} />;
    }
    if (currentPath === '/verify-otp' || currentPath === '/verify-email') {
      return <CreateAccountPage navigate={navigate} />;
    }

    // Dedicated Citizen Incident Tracking Page (/citizen/incident/:id)
    if (currentPath.startsWith('/citizen/incident/')) {
      if (!user) return <LoginPage navigate={navigate} />;
      const incidentId = currentPath.replace('/citizen/incident/', '').split('/')[0];
      return <CitizenIncidentPage incidentId={incidentId} navigate={navigate} />;
    }

    // Role-specific protected dashboards (Section 12: PREVENT WRONG DASHBOARD ACCESS)
    if (currentPath.startsWith('/citizen')) {
      if (!user) return <LoginPage navigate={navigate} />;
      if (!checkRoleAccess('citizen')) return renderAccessDenied('Citizen');
      return <CitizenDashboard currentPath={currentPath} navigate={navigate} />;
    }
    if (currentPath.startsWith('/fire-team')) {
      if (!user) return <LoginPage navigate={navigate} />;
      if (!checkRoleAccess('fire_team')) return renderAccessDenied('Fire Team Command');
      return <FireTeamDashboard currentPath={currentPath} navigate={navigate} />;
    }
    if (currentPath.startsWith('/hospital')) {
      if (!user) return <LoginPage navigate={navigate} />;
      if (!checkRoleAccess('hospital')) return renderAccessDenied('Hospital Trauma Intake');
      return <HospitalDashboard currentPath={currentPath} navigate={navigate} />;
    }
    if (currentPath === '/commander/analytics') {
      if (!user) return <LoginPage navigate={navigate} />;
      if (!checkRoleAccess('admin')) return renderAccessDenied('Command Analytics');
      return <AnalyticsPage />;
    }
    if (currentPath === '/commander/audit') {
      if (!user) return <LoginPage navigate={navigate} />;
      if (!checkRoleAccess('admin')) return renderAccessDenied('Audit Logs');
      return <AuditLogPage />;
    }
    if (currentPath.startsWith('/admin')) {
      if (!user) return <LoginPage navigate={navigate} />;
      if (!checkRoleAccess('admin')) return renderAccessDenied('Crisis Command Directorate');
      return <AdminDashboard navigate={navigate} />;
    }
    if (currentPath.startsWith('/commander')) {
      if (!user) return <LoginPage navigate={navigate} />;
      if (!checkRoleAccess('admin')) return renderAccessDenied('Crisis Command Operations');
      return <CommanderDashboard />;
    }

    // Default fallback
    return <LandingPage navigate={navigate} />;
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans">
      {/* Internal Navigation: automatically hidden on public landing and auth pages (Part 2 Rule) */}
      <Navbar currentPath={currentPath} navigate={navigate} />

      {/* Live Animated Notification Banner (Fires on Replan or New Incident) */}
      {liveBanner && (
        <div className="fixed top-24 right-4 z-50 max-w-sm w-full p-4 rounded-xl bg-[#0b1329]/95 border border-cyan-400 shadow-2xl backdrop-blur-md animate-bounce">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs text-white font-mono">{liveBanner.title}</div>
                <div className="text-[11px] text-slate-300 mt-1">{liveBanner.message}</div>
              </div>
            </div>
            <button onClick={clearLiveBanner} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Page View with Error Boundary */}
      <main className="flex-1 pb-16">
        <ErrorBoundary>
          {renderPage()}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
