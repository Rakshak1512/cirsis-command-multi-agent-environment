import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, LogOut, Radio, Check, CheckCheck, ExternalLink,
  Menu, X, Shield, Activity, Flame, Hospital as HospitalIcon,
  HelpCircle, ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react';
import { useCrisisStore } from '../../store/useCrisisStore';
import { NotificationItem } from '../../types';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, navigate }) => {
  const { user, setUser, notifications, connectionStatus, markNotificationRead, markAllNotificationsRead } = useCrisisStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showNotifications &&
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(event.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };

    // Close on Escape key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications]);

  // Hidden on public landing and authentication screens
  const isPublicPage = ['/', '/login', '/create-account', '/forgot-password', '/verify-otp', '/verify-email'].includes(currentPath);
  if (isPublicPage) {
    return null;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    setUser(null, '');
    localStorage.removeItem('crisis_token');
    localStorage.removeItem('crisis_user');
    navigate('/login');
  };

  const role = (user?.role || 'COMMANDER').toUpperCase();

  const handleNotificationClick = (n: NotificationItem) => {
    markNotificationRead(n.id);
    setShowNotifications(false);

    if (n.incident_id) {
      if (role === 'CITIZEN') {
        navigate(`/citizen/dashboard?incident=${n.incident_id}`);
      } else if (role === 'FIRE_TEAM') {
        navigate(`/fire-team/dashboard?incident=${n.incident_id}`);
      } else if (role === 'HOSPITAL') {
        navigate(`/hospital/dashboard?incident=${n.incident_id}`);
      } else {
        navigate(`/commander/dashboard?incident=${n.incident_id}`);
      }
    }
  };

  // Connection indicator styling
  const renderConnectionBadge = () => {
    if (connectionStatus === 'LIVE') {
      return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold shadow-glow-emerald">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          <span>LIVE</span>
        </div>
      );
    }
    if (connectionStatus === 'RECONNECTING') {
      return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold">
          <RefreshCw className="w-2.5 h-2.5 text-amber-400 animate-spin" />
          <span>RECONNECTING</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-mono font-bold">
        <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
        <span>OFFLINE</span>
      </div>
    );
  };

  // Nav Links for Desktop & Mobile
  const getNavLinks = () => {
    switch (role) {
      case 'CITIZEN':
        return [
          { label: 'DASHBOARD', path: '/citizen/dashboard', isActive: currentPath === '/citizen/dashboard' || currentPath === '/citizen' },
          { label: 'REPORT EMERGENCY', path: '/citizen/report', isEmergency: true, isActive: currentPath === '/citizen/report' },
          { label: 'MY INCIDENTS', path: '/citizen/incidents', isActive: currentPath === '/citizen/incidents' },
          { label: 'NOTIFICATIONS', path: '/citizen/notifications', badge: unreadCount > 0 ? unreadCount : undefined, isActive: currentPath === '/citizen/notifications' },
          { label: 'HELP', path: '/citizen/help', isActive: currentPath === '/citizen/help' },
        ];
      case 'FIRE_TEAM':
        return [
          { label: 'DASHBOARD', path: '/fire-team/dashboard', isActive: currentPath === '/fire-team/dashboard' || currentPath === '/fire-team' },
          { label: 'ALL INCIDENTS', path: '/fire-team/incidents', isActive: currentPath === '/fire-team/incidents' },
          { label: 'HISTORY', path: '/fire-team/history', isActive: currentPath === '/fire-team/history' },
        ];
      case 'HOSPITAL':
        return [
          { label: 'DASHBOARD', path: '/hospital/dashboard', isActive: currentPath === '/hospital/dashboard' || currentPath === '/hospital' },
          { label: 'ALL INCIDENTS', path: '/hospital/incidents', isActive: currentPath === '/hospital/incidents' || currentPath === '/hospital/emergencies' },
          { label: 'CAPACITY', path: '/hospital/capacity', isActive: currentPath === '/hospital/capacity' },
          { label: 'HISTORY', path: '/hospital/history', isActive: currentPath === '/hospital/history' },
        ];
      case 'ADMIN':
        return [
          { label: 'Directorate', path: '/admin/dashboard', isActive: currentPath.startsWith('/admin') },
          { label: 'Tactical Ops', path: '/commander/dashboard', isActive: currentPath === '/commander/dashboard' },
          { label: 'Analytics', path: '/commander/analytics', isActive: currentPath === '/commander/analytics' },
          { label: 'Audit Logs', path: '/commander/audit', isActive: currentPath === '/commander/audit' },
        ];
      case 'COMMANDER':
      default:
        return [
          { label: 'Command Center', path: '/commander/dashboard', isActive: currentPath === '/commander/dashboard' || currentPath === '/commander' },
          { label: 'Analytics', path: '/commander/analytics', isActive: currentPath === '/commander/analytics' },
          { label: 'Audit Logs', path: '/commander/audit', isActive: currentPath === '/commander/audit' },
        ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <header className="glass-header sticky top-0 z-[1000] border-b border-cyan-500/20 backdrop-blur-xl bg-[#080d1e]/95">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => {
            const homePath = role === 'CITIZEN' ? '/citizen/dashboard' : role === 'FIRE_TEAM' ? '/fire-team/dashboard' : role === 'HOSPITAL' ? '/hospital/dashboard' : '/commander/dashboard';
            navigate(homePath);
          }}
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-glow group-hover:scale-105 transition-transform">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-display font-bold text-base sm:text-lg tracking-wider text-white">CRISIS COMMAND</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold">
                {role}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight hidden sm:block">Active Operations Network</p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-1.5">
          {navLinks.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-all flex items-center space-x-1.5 ${
                item.isActive
                  ? item.isEmergency
                    ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-glow-red'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-glow'
                  : item.isEmergency
                  ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right side: Live Connection Badge, Notifications, User & Mobile Menu */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Live WebSocket Status Badge */}
          <div className="hidden sm:block">
            {renderConnectionBadge()}
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              ref={bellButtonRef}
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all shadow-sm focus:outline-none"
              title="Emergency Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse shadow-glow-red">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown (Fits within screen viewport without clipping) */}
            {showNotifications && (
              <div
                ref={notifDropdownRef}
                className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl liquid-glass border border-cyan-500/40 shadow-2xl p-4 z-[1100] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                      EMERGENCY BROADCASTS
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                        {unreadCount} NEW
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllNotificationsRead()}
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 font-bold hover:underline flex items-center space-x-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>MARK ALL READ</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 mt-3 pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-xs text-slate-500 py-8 text-center font-mono space-y-2">
                      <Bell className="w-6 h-6 text-slate-700 mx-auto" />
                      <p>No active broadcasts or alerts</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 rounded-xl border text-xs font-mono transition-all cursor-pointer relative group ${
                          !n.read
                            ? 'bg-slate-900/95 border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-ping" />
                            )}
                            <span className={`font-bold truncate ${
                              n.type === 'CRITICAL' ? 'text-rose-400' : n.type === 'SUCCESS' ? 'text-emerald-300' : 'text-cyan-300'
                            }`}>
                              {n.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-slate-300 text-[11px] mt-1 break-words leading-relaxed">
                          {n.message}
                        </p>

                        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800/60 text-[10px]">
                          {n.incident_id ? (
                            <span className="text-cyan-400 flex items-center space-x-1 group-hover:underline">
                              <span>View Incident Details</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          ) : (
                            <span className="text-slate-500">System Notification</span>
                          )}

                          {!n.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markNotificationRead(n.id);
                              }}
                              className="text-slate-400 hover:text-white flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800"
                              title="Mark as read"
                            >
                              <Check className="w-2.5 h-2.5" />
                              <span>Read</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Badge & Logout */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
            <div className="hidden md:block text-right">
              <div className="text-xs font-bold font-mono text-white leading-tight truncate max-w-[130px]">
                {user?.full_name || 'Commander'}
              </div>
              <div className="text-[10px] font-mono text-cyan-400 leading-tight truncate max-w-[130px]">
                {user?.email || 'station@crisiscommand.org'}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-all shadow-sm"
              title="Logout session"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
              aria-label="Toggle Navigation Menu"
            >
              {showMobileMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {showMobileMenu && (
        <div className="lg:hidden border-t border-cyan-500/20 bg-[#080d1e]/98 px-4 py-3 space-y-2 animate-in slide-in-from-top duration-200 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>NETWORK NAVIGATION</span>
            <div>{renderConnectionBadge()}</div>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {navLinks.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setShowMobileMenu(false);
                }}
                className={`w-full p-2.5 rounded-xl text-xs font-mono font-bold tracking-wider text-left transition-all flex items-center justify-between ${
                  item.isActive
                    ? item.isEmergency
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-glow-red'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-glow'
                    : item.isEmergency
                    ? 'text-rose-400 hover:bg-rose-500/10'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
