import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Video, 
  AlertTriangle, 
  Bot, 
  Settings,
  Bell,
  User,
  Package,
  Menu,
  X,
  ShieldCheck,
  Check,
  Clock,
  ChevronRight
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getEvents } from '../api/events';
import type { Event } from '../types/event';

const READ_NOTIFICATIONS_KEY = 'wms_read_notifications';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Event[]>([]);
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
  const location = useLocation();

  // Load high & critical events for notifications
  useEffect(() => {
    let isMounted = true;
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

  // Handle click outside and Escape key to close popover
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
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotificationOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationOpen]);

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

  const unreadCount = notifications.filter((n) => !readIds.includes(n.event_id)).length;

  const navItems = [
    { name: 'Live Monitoring', path: '/', icon: Video },
    { name: 'Analytics Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Incident Log', path: '/incidents', icon: AlertTriangle },
    { name: 'AI Assistant', path: '/assistant', icon: Bot },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  // Close mobile drawer on route change during render
  const [prevPath, setPrevPath] = React.useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 flex font-sans selection:bg-primary/20">
      
      {/* Desktop Left Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex sticky top-0 h-screen shrink-0 z-30">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">WMS Intel</h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Platform</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium premium-transition btn-interactive ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200/60">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate">Supervisor Terminal</p>
              <p className="text-xs text-slate-500 truncate">Dock Bay Area 4</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop & Panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 md:hidden"
            />

            {/* Slide-out Menu */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed top-0 bottom-0 left-0 w-72 bg-white z-50 md:hidden shadow-2xl flex flex-col"
            >
              <div className="p-5 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">WMS Intel</h2>
                    <p className="text-[10px] text-slate-500 font-medium uppercase">Mobile Console</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => 
                      `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                        isActive 
                          ? 'bg-primary/10 text-primary font-semibold' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </NavLink>
                ))}
              </nav>

              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Surveillance Engine Active</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 p-1.5 rounded-lg md:hidden">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Warehouse Intelligence Platform
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sensor Bus
            </span>
            <div className="relative">
              <button 
                ref={bellButtonRef}
                type="button"
                onClick={() => setNotificationOpen((prev) => !prev)}
                className={`text-slate-500 hover:text-primary p-2 rounded-full btn-interactive relative ${
                  notificationOpen ? 'bg-slate-100 text-primary' : 'hover:bg-slate-100'
                }`}
                title="Alert notifications"
                aria-label="Alert notifications"
                aria-expanded={notificationOpen}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationOpen && (
                  <motion.div
                    ref={popoverRef}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-slate-200 z-50 overflow-hidden text-left ring-1 ring-black/5"
                  >
                    {/* Header */}
                    <div className="p-3.5 px-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 tracking-wide uppercase">
                          Urgent Alerts
                        </span>
                        {unreadCount > 0 && (
                          <span className="text-[11px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="text-[11px] font-medium text-slate-500 hover:text-primary flex items-center gap-1 hover:underline"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark all read
                        </button>
                      )}
                    </div>

                    {/* Notifications list */}
                    <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs">
                          <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                          <p className="font-medium text-slate-700">No urgent alerts detected</p>
                          <p className="text-slate-400 mt-0.5">All warehouse safety metrics nominal</p>
                        </div>
                      ) : (
                        notifications.slice(0, 5).map((item) => {
                          const isUnread = !readIds.includes(item.event_id);
                          return (
                            <Link
                              key={item.event_id}
                              to={`/incident/${item.event_id}`}
                              onClick={() => markOneAsRead(item.event_id)}
                              className={`p-3.5 block transition-colors ${
                                isUnread ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                        item.risk_level === 'Critical'
                                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                                      }`}
                                    >
                                      {item.risk_level}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-900 truncate">
                                      {item.behaviour}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 line-clamp-1">
                                    {item.description || item.reason}
                                  </p>
                                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {item.created_at 
                                        ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                                        : (item.timestamp !== undefined ? `Video @ ${item.timestamp.toFixed(1)}s` : 'Recent')}
                                    </span>
                                    <span>• {item.bay_id || 'Unassigned Bay'}</span>
                                  </div>
                                </div>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" />
                                )}
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 text-center">
                      <Link
                        to="/incidents"
                        onClick={() => setNotificationOpen(false)}
                        className="text-xs font-medium text-primary hover:text-blue-700 inline-flex items-center gap-1"
                      >
                        Open Incident Log <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>

    </div>
  );
};
