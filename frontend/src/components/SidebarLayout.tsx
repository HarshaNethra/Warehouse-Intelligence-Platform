import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Video, 
  AlertTriangle, 
  Bot, 
  Settings as SettingsIcon,
  Bell,
  Package,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  Cpu,
  BarChart3,
  BookOpen,
  Truck,
  Search,
  ChevronDown,
  Building2,
  Check,
  Database
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { UrgentAlertsDropdown } from './UrgentAlertsDropdown';
import { FloatingChatbot } from './FloatingChatbot';
import { LiveAlertToast } from './LiveAlertToast';
import { useAuth } from '../context/AuthContext';
import { useProvenance } from '../context/ProvenanceContext';
import { getEvents } from '../api/events';
import { getFacilities, type Facility } from '../api/facilities';
import type { Event } from '../types/event';

const READ_NOTIFICATIONS_KEY = 'wms_read_notifications';

export const CANONICAL_FACILITIES: Facility[] = [
  {
    id: 'FAC-001',
    name: 'Bengaluru Distribution Center',
    location: 'Hoskote Logistics Park • 4 Active Docks',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
  },
  {
    id: 'FAC-002',
    name: 'Mumbai Mega Hub',
    location: 'Bhiwandi Logistics Gateway • 6 Active Docks',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
  },
  {
    id: 'FAC-003',
    name: 'Delhi NCR Fulfillment Center',
    location: 'Bilaspur Industrial Corridor • 8 Active Docks',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
  },
  {
    id: 'FAC-004',
    name: 'Chennai Port Logistics Depot',
    location: 'Sriperumbudur Automotive Hub • 4 Active Docks',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
  },
];

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { provenanceEnabled, toggleProvenance } = useProvenance();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<Event[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>(CANONICAL_FACILITIES);
  const [selectedFacility, setSelectedFacility] = useState<Facility>(() => {
    try {
      const savedId = localStorage.getItem('wms_active_facility_id');
      const match = CANONICAL_FACILITIES.find((f) => f.id === savedId);
      return match || CANONICAL_FACILITIES[0];
    } catch {
      return CANONICAL_FACILITIES[0];
    }
  });
  const [globalQuery, setGlobalQuery] = useState('');
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const facilityRef = useRef<HTMLDivElement>(null);
  const facilityBtnRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    getFacilities()
      .then((data) => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          setFacilities(data);
          const savedId = localStorage.getItem('wms_active_facility_id');
          const matched = data.find((f) => f.id === savedId) || data[0];
          setSelectedFacility(matched);
        }
      })
      .catch((err) => console.warn('Failed to load facilities:', err));

    getEvents({ limit: 15 })
      .then((events) => {
        if (!isMounted) return;
        const urgent = events.filter(
          (e) => e.risk_level === 'Critical' || e.risk_level === 'High'
        );
        setNotifications(urgent);
      })
      .catch((err) => console.warn('Failed to load notifications:', err));

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notificationOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(e.target as Node)
      ) {
        setNotificationOpen(false);
      }

      if (
        facilityDropdownOpen &&
        facilityRef.current &&
        !facilityRef.current.contains(e.target as Node) &&
        facilityBtnRef.current &&
        !facilityBtnRef.current.contains(e.target as Node)
      ) {
        setFacilityDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotificationOpen(false);
        setFacilityDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationOpen, facilityDropdownOpen]);

  const handleSelectFacility = (fac: Facility) => {
    setSelectedFacility(fac);
    setFacilityDropdownOpen(false);
    try {
      localStorage.setItem('wms_active_facility_id', fac.id);
      window.dispatchEvent(new CustomEvent('wms:facility-changed', { detail: fac }));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.event_id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    try {
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const markOneAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      try {
        localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
    setNotificationOpen(false);
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalQuery.trim()) {
      navigate(`/incidents?search=${encodeURIComponent(globalQuery.trim())}`);
    }
  };

  const unreadCount = notifications.filter((n) => !readIds.includes(n.event_id)).length;

  const navGroups = [
    {
      group: 'OPERATIONS',
      items: [
        { name: 'Live Operations', path: '/', icon: Video },
        { name: 'Incidents', path: '/incidents', icon: AlertTriangle },
        { name: 'Loading Bays', path: '/loading-bays', icon: Truck },
      ]
    },
    {
      group: 'INTELLIGENCE',
      items: [
        { name: 'Behaviour Intelligence', path: '/dashboard', icon: BarChart3 },
        { name: 'Behaviour Library', path: '/behaviour-library', icon: BookOpen },
        { name: 'AI Assistant', path: '/assistant', icon: Bot },
      ]
    },
    {
      group: 'MANAGEMENT',
      items: [
        { name: 'Model Performance', path: '/model-evaluation', icon: Cpu },
        { name: 'Settings', path: '/settings', icon: SettingsIcon },
      ]
    }
  ];

  const [prevPath, setPrevPath] = React.useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 flex font-sans selection:bg-blue-500/10">
      
      {/* Desktop Left Sidebar (Palantir/Samsara Enterprise Clean Theme) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex sticky top-0 h-screen shrink-0 z-30 shadow-xs">
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">WMS Intel</h1>
            <p className="text-[10px] text-blue-600 font-semibold tracking-wider uppercase">AI Field Intelligence</p>
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
          {navGroups.map((sec) => (
            <div key={sec.group} className="space-y-1">
              <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {sec.group}
              </p>
              {sec.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700 font-semibold border-l-3 border-blue-600 shadow-2xs' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon className={`w-4 h-4 ${location.pathname === item.path ? 'text-blue-600' : 'text-slate-400'}`} />
                  {item.name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer Profile & System Status */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs">
                {user?.full_name?.charAt(0) || 'D'}
              </div>
              <div className="overflow-hidden min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {user?.full_name || 'Dock Supervisor'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  Site: {selectedFacility?.name || 'Bengaluru DC'} ({selectedFacility?.id || user?.facility_id || 'FAC-001'})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors"
              title="Logout Session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All systems operational</span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 md:hidden"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-white z-50 md:hidden shadow-2xl flex flex-col border-r border-slate-200 text-slate-900"
            >
              <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">WMS Intel</h2>
                    <p className="text-[10px] text-blue-600 font-semibold uppercase">Mobile Console</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
                {navGroups.map((sec) => (
                  <div key={sec.group} className="space-y-1">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {sec.group}
                    </p>
                    {sec.items.map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) => 
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                            isActive 
                              ? 'bg-blue-50 text-blue-700 font-semibold' 
                              : 'text-slate-600 hover:bg-slate-50'
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4 text-slate-400" />
                        {item.name}
                      </NavLink>
                    ))}
                  </div>
                ))}
              </nav>

              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>AI Field Intelligence Active</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Top Header Bar */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Location / Facility Selector Dropdown */}
            <div className="relative">
              <button
                ref={facilityBtnRef}
                type="button"
                onClick={() => setFacilityDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs text-slate-800 transition-all cursor-pointer shadow-2xs max-w-[160px] sm:max-w-none truncate ${
                  facilityDropdownOpen
                    ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
                title="Switch Warehouse Facility / Site"
                aria-label="Switch Facility"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="flex items-center gap-1.5 min-w-0 text-left truncate">
                  <span className="font-bold text-slate-900 truncate">
                    {selectedFacility?.name || 'Bengaluru DC'}
                  </span>
                  <span className="text-slate-300 hidden sm:inline">/</span>
                  <span className="text-slate-500 font-medium text-[11px] whitespace-nowrap hidden sm:inline">Active Docks</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0 transition-transform ${
                    facilityDropdownOpen ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {facilityDropdownOpen && (
                  <motion.div
                    ref={facilityRef}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-900">Switch Warehouse Site</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                        {facilities.length} Active Hubs
                      </span>
                    </div>

                    <div className="p-1.5 space-y-1 max-h-72 overflow-y-auto">
                      {facilities.map((fac) => {
                        const isSelected = selectedFacility?.id === fac.id;
                        return (
                          <button
                            key={fac.id}
                            type="button"
                            onClick={() => handleSelectFacility(fac)}
                            className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50/80 border border-blue-200 text-blue-900'
                                : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs truncate">{fac.name}</span>
                                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {fac.id}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                {fac.location || 'Distribution & Logistics Center'}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-blue-600 shrink-0 font-bold" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                      <p className="text-[10px] text-slate-500 font-medium">
                        Live telemetry and video inference sync automatically with selected hub.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center Global Search */}
          <form onSubmit={handleGlobalSearch} className="hidden lg:flex items-center max-w-md w-full mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search incidents, bays, behaviours..."
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
              />
            </div>
          </form>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dev Provenance Overlay Toggle */}
            <button
              type="button"
              onClick={toggleProvenance}
              className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-mono px-2 sm:px-2.5 py-1 rounded-lg border transition-all ${
                provenanceEnabled
                  ? 'bg-slate-900 text-blue-400 border-slate-700 shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
              title="Toggle Developer Data Provenance Overlay"
            >
              <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="hidden sm:inline">Dev Overlay: {provenanceEnabled ? 'ON' : 'OFF'}</span>
              <span className="sm:hidden font-bold">{provenanceEnabled ? 'DEV' : 'OFF'}</span>
            </button>

            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-800">AI Vision Active</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500 font-mono text-[11px]">30 FPS · 18ms</span>
            </span>

            <div className="relative">
              <button 
                ref={bellButtonRef}
                type="button"
                onClick={() => setNotificationOpen((prev) => !prev)}
                className={`text-slate-500 hover:text-blue-600 p-2 rounded-full relative transition-colors ${
                  notificationOpen ? 'bg-slate-100 text-blue-600' : 'hover:bg-slate-100'
                }`}
                title="Alert notifications"
                aria-label="Alert notifications"
                aria-expanded={notificationOpen}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationOpen && (
                  <UrgentAlertsDropdown
                    notifications={notifications}
                    readIds={readIds}
                    unreadCount={unreadCount}
                    popoverRef={popoverRef}
                    onMarkAllRead={markAllAsRead}
                    onMarkOneRead={markOneAsRead}
                    onClose={() => setNotificationOpen(false)}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden bg-[#F5F7FA]">
          {children}
        </main>
      </div>

      {/* Real-Time Floating Incident Alert Toaster */}
      <LiveAlertToast />

      {/* Floating Global AI Chatbot Widget (suppressed on routes with dedicated chat views) */}
      {location.pathname !== '/assistant' && !location.pathname.startsWith('/incident') && <FloatingChatbot />}
    </div>
  );
};
