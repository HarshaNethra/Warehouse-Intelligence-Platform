import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ShieldCheck, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatEpochDate } from '../utils/formatters';
import type { Event } from '../types/event';

export interface UrgentAlertsDropdownProps {
  notifications: Event[];
  readIds: string[];
  unreadCount: number;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  onMarkAllRead: () => void;
  onMarkOneRead: (id: string) => void;
  onClose: () => void;
}

export const UrgentAlertsDropdown: React.FC<UrgentAlertsDropdownProps> = ({
  notifications,
  readIds,
  unreadCount,
  popoverRef,
  onMarkAllRead,
  onMarkOneRead,
  onClose,
}) => {
  return (
    <motion.div
      ref={popoverRef}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white shadow-2xl rounded-2xl border border-slate-200 z-50 overflow-hidden text-left text-slate-900"
    >
      {/* Header */}
      <div className="p-3.5 px-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs text-slate-900 tracking-wide uppercase">
            Urgent Alerts
          </span>
          {unreadCount > 0 && (
            <span className="text-[11px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-90" />
            <p className="font-bold text-slate-900">No urgent alerts detected</p>
            <p className="text-slate-500 mt-0.5">All warehouse safety metrics nominal</p>
          </div>
        ) : (
          notifications.slice(0, 5).map((item) => {
            const isUnread = !readIds.includes(item.event_id);
            const isCrit = item.risk_level === 'Critical' || (item.risk_level as string) === 'CRITICAL';
            return (
              <Link
                key={item.event_id}
                to={`/incident/${item.event_id}`}
                onClick={() => onMarkOneRead(item.event_id)}
                className={`p-3.5 block transition-colors ${
                  isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isCrit
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.risk_level}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.behaviour}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-1">
                      {item.description || item.reason}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatEpochDate(item.created_at || item.timestamp)}
                      </span>
                      <span>• {item.bay_id || 'Loading Bay 1'}</span>
                    </div>
                  </div>
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-slate-50/90 border-t border-slate-100 text-center">
        <Link
          to="/incidents"
          onClick={onClose}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 transition-colors"
        >
          Open Incident Log <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
};
