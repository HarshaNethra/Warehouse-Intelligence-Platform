import React, { useState, useMemo } from 'react';
import { AlertTriangle, Clock, Play, UserPlus, CheckCircle2, Filter, Loader2, ShieldAlert } from 'lucide-react';
import { useEvents } from '../hooks/useEvents';
import { acknowledgeIncident, dispatchIncident } from '../api/events';

export interface ActionableAlertFeedProps {
  onSeekIncident?: (timestampSeconds: number) => void;
  className?: string;
}

export const ActionableAlertFeed: React.FC<ActionableAlertFeedProps> = ({ onSeekIncident, className }) => {
  const { events, loading, refetch } = useEvents({ limit: 50 });
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'UNREAD'>('ALL');
  const [operatingIds, setOperatingIds] = useState<Record<string, boolean>>({});

  const handleAction = async (eventId: string, currentStatus?: string) => {
    if (operatingIds[eventId]) return;
    setOperatingIds((prev) => ({ ...prev, [eventId]: true }));

    try {
      const statusUpper = (currentStatus || 'UNRESOLVED').toUpperCase();
      if (statusUpper === 'DISPATCHED') {
        await acknowledgeIncident(eventId);
      } else {
        await dispatchIncident(eventId);
      }
      void refetch();
    } catch (err) {
      console.error('Failed to update incident status:', err);
    } finally {
      setOperatingIds((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const isCritical = ev.risk_level?.toUpperCase() === 'CRITICAL' || ev.risk_score >= 80;
      const isUnresolved = (ev.status || 'UNRESOLVED').toUpperCase() === 'UNRESOLVED';

      if (filter === 'CRITICAL') return isCritical;
      if (filter === 'UNREAD') return isUnresolved;
      return true;
    });
  }, [events, filter]);

  const unresolvedCount = useMemo(() => {
    return events.filter((ev) => (ev.status || 'UNRESOLVED').toUpperCase() === 'UNRESOLVED').length;
  }, [events]);

  const formatSeekTime = (seconds: number | undefined | null) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const seekVal = seconds > 100000 ? Math.floor(seconds % 60) : seconds;
    const mins = Math.floor(seekVal / 60);
    const secs = Math.floor(seekVal % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getSeekSeconds = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return 0;
    return seconds > 100000 ? Math.floor(seconds % 60) : seconds;
  };

  if (loading && events.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 text-slate-900 flex flex-col items-center justify-center min-h-[300px] gap-2 shadow-2xs ${className || ''}`}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs text-slate-500 font-mono">Loading telemetry stream...</span>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 space-y-4 text-slate-900 shadow-2xs ${className || ''}`}>
      {/* 1. Feed Header & Unresolved Badge */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-bold text-slate-900">Actionable Incidents</h3>
        </div>
        {unresolvedCount > 0 ? (
          <span className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {unresolvedCount} Unresolved
          </span>
        ) : (
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            All Resolved
          </span>
        )}
      </div>

      {/* 2. Filter Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`py-1 rounded text-center font-medium transition-colors cursor-pointer ${
            filter === 'ALL' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All ({events.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('CRITICAL')}
          className={`py-1 rounded text-center font-medium transition-colors cursor-pointer ${
            filter === 'CRITICAL' ? 'bg-rose-50 text-rose-700 font-semibold border border-rose-200' : 'text-slate-600 hover:text-rose-700'
          }`}
        >
          Critical
        </button>
        <button
          type="button"
          onClick={() => setFilter('UNREAD')}
          className={`py-1 rounded text-center font-medium transition-colors cursor-pointer ${
            filter === 'UNREAD' ? 'bg-amber-50 text-amber-800 font-semibold border border-amber-200' : 'text-slate-600 hover:text-amber-700'
          }`}
        >
          Unresolved
        </button>
      </div>

      {/* 3. Incident Card Feed List */}
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {filteredEvents.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs space-y-2">
            <ShieldAlert className="w-6 h-6 text-slate-400 mx-auto" />
            <p>No active incidents match current filter</p>
          </div>
        ) : (
          filteredEvents.map((alert) => {
            const riskUpper = (alert.risk_level || 'MEDIUM').toUpperCase();
            const isCritical = riskUpper === 'CRITICAL' || alert.risk_score >= 80;
            const statusUpper = (alert.status || 'UNRESOLVED').toUpperCase();
            const isDispatched = statusUpper === 'DISPATCHED';
            const isOperating = operatingIds[alert.event_id];

            const cardStyle = isCritical
              ? 'bg-slate-50 border-l-4 border-l-red-500 border border-slate-200 rounded-r-lg p-3 space-y-2'
              : 'bg-slate-50 border-l-4 border-l-amber-500 border border-slate-200 rounded-r-lg p-3 space-y-2';

            const badgeStyle = isCritical
              ? 'bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200'
              : 'bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200';

            return (
              <div key={alert.event_id} className={cardStyle}>
                {/* Header: Badge + Event ID */}
                <div className="flex items-center justify-between">
                  <span className={badgeStyle}>
                    {riskUpper} ({alert.risk_score.toFixed(1)}%)
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" /> {alert.event_id}
                  </span>
                </div>

                {/* Event Title & Details */}
                <h4 className="text-xs font-bold text-slate-900">{alert.behaviour}</h4>
                <p className="text-[11px] text-slate-600 leading-normal line-clamp-2">
                  {alert.description}
                </p>

                {/* Bay Location & Action Status */}
                <div className="text-[11px] text-slate-500 pt-1 flex justify-between items-center border-t border-slate-200 font-mono">
                  <span>{alert.bay_id || 'Loading Bay 1'} • {formatSeekTime(alert.timestamp)}</span>
                  <span className={isDispatched ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
                    {isDispatched ? '👮 Dispatched' : '⏳ Awaiting Action'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => onSeekIncident && onSeekIncident(getSeekSeconds(alert.timestamp))}
                    className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs py-1.5 px-2 rounded flex items-center justify-center gap-1 font-semibold transition-colors cursor-pointer shadow-2xs"
                    title={`Seek video to ${formatSeekTime(alert.timestamp)}`}
                  >
                    <Play className="w-3 h-3 text-red-600 fill-current" />
                    <span>Seek {formatSeekTime(alert.timestamp)}</span>
                  </button>

                  {isDispatched ? (
                    <button
                      type="button"
                      onClick={() => handleAction(alert.event_id, alert.status)}
                      disabled={isOperating}
                      className="flex-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-xs py-1.5 px-2 rounded flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isOperating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      <span>Dispatched</span>
                    </button>
                  ) : isCritical ? (
                    <button
                      type="button"
                      onClick={() => handleAction(alert.event_id, alert.status)}
                      disabled={isOperating}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-1.5 px-2 rounded flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isOperating ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                      <span>Dispatch Admin</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(alert.event_id, alert.status)}
                      disabled={isOperating}
                      className="flex-1 bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs py-1.5 px-2 rounded flex items-center justify-center gap-1 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isOperating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>Acknowledge</span>}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-slate-400" /> Threshold: 75% Peak
        </span>
        <span>Samsara Engine Mesh</span>
      </div>
    </div>
  );
};

export default ActionableAlertFeed;


