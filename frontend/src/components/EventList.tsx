import React, { useState, useMemo, useEffect } from 'react';
import { useEvents } from '../hooks/useEvents';
import { exportEventsCsv, acknowledgeIncident, batchDeleteIncidents, batchUpdateIncidentStatus } from '../api/events';
import { exportComprehensiveEventsCsv, generateSafetyAuditPdfReport } from '../utils/reportExporter';
import { RiskBadge } from './RiskBadge';
import { formatTimestamp } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Search, Filter, X, ShieldAlert, Download, Loader2, CheckCircle2, AlertOctagon, Trash2, CheckSquare, Square, FileText } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Event } from '../types/event';

const VALID_RISKS = ['All', 'Critical', 'High', 'Medium', 'Low'];

export type SortOption = 'newest' | 'highest-risk' | 'lowest-risk' | 'behaviour';

export interface EventListProps {
  className?: string;
}

export const EventList: React.FC<EventListProps> = ({ className }) => {
  const { events: fetchedEvents, loading, error, refetch } = useEvents();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [localEvents, setLocalEvents] = useState<Event[]>([]);
  const [acknowledgingIds, setAcknowledgingIds] = useState<Record<string, boolean>>({});

  // Multi-select & Batch Operation States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchOperating, setIsBatchOperating] = useState<boolean>(false);

  useEffect(() => {
    setLocalEvents(fetchedEvents);
  }, [fetchedEvents]);

  const riskFromUrl = useMemo(() => {
    const rawRisk = searchParams.get('risk');
    if (!rawRisk) return 'All';
    const cleanRisk = rawRisk.trim();
    const match = VALID_RISKS.find(r => r.toLowerCase() === cleanRisk.toLowerCase());
    return match || 'All';
  }, [searchParams]);

  const selectedRisk = riskFromUrl;
  const initialSearch = searchParams.get('search') || searchParams.get('behaviour') || searchParams.get('q') || '';
  const initialBay = searchParams.get('bay') || 'All';

  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [selectedBay, setSelectedBay] = useState<string>(initialBay);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const currentParamsStr = searchParams.toString();
  const [prevParamsStr, setPrevParamsStr] = useState<string>(currentParamsStr);
  if (prevParamsStr !== currentParamsStr) {
    setPrevParamsStr(currentParamsStr);
    const nextSearch = searchParams.get('search') || searchParams.get('behaviour') || searchParams.get('q') || '';
    setSearchQuery(nextSearch);

    const nextBay = searchParams.get('bay');
    if (nextBay) {
      setSelectedBay(nextBay);
    }
  }

  const handleRiskChange = (risk: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (risk === 'All') {
      nextParams.delete('risk');
    } else {
      nextParams.set('risk', risk);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedBay('All');
    setSortBy('newest');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const handleAcknowledge = async (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (acknowledgingIds[eventId]) return;
    setAcknowledgingIds(prev => ({ ...prev, [eventId]: true }));

    try {
      const updated = await acknowledgeIncident(eventId);
      setLocalEvents(prev =>
        prev.map(item =>
          item.event_id === eventId
            ? {
                ...item,
                status: 'ACKNOWLEDGED',
                acknowledged_by_user_id: updated.acknowledged_by_user_id || user?.email || user?.id || 'operator',
                acknowledged_at: updated.acknowledged_at || new Date().toISOString()
              }
            : item
        )
      );
    } catch (err) {
      console.error('Failed to acknowledge incident:', err);
    } finally {
      setAcknowledgingIds(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const filteredEvents = useMemo(() => {
    return localEvents.filter(e => {
      let matchRisk = selectedRisk === 'All';
      if (!matchRisk) {
        matchRisk = (e.risk_level || '').toLowerCase() === selectedRisk.toLowerCase();
      }

      const matchBay = selectedBay === 'All' || (e.bay_id || '').toLowerCase() === selectedBay.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        (e.behaviour && e.behaviour.toLowerCase().includes(q)) || 
        (e.description && e.description.toLowerCase().includes(q)) || 
        (e.reason && e.reason.toLowerCase().includes(q)) ||
        (e.event_id && e.event_id.toLowerCase().includes(q)) ||
        (e.bay_id && e.bay_id.toLowerCase().includes(q)) ||
        (e.camera_id && e.camera_id.toLowerCase().includes(q));

      return matchRisk && matchBay && matchQuery;
    });
  }, [localEvents, selectedRisk, selectedBay, searchQuery]);

  const sortedAndFilteredEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      if (sortBy === 'newest') {
        return (b.timestamp ?? 0) - (a.timestamp ?? 0);
      }
      if (sortBy === 'highest-risk') {
        return (b.risk_score ?? 0) - (a.risk_score ?? 0);
      }
      if (sortBy === 'lowest-risk') {
        return (a.risk_score ?? 0) - (b.risk_score ?? 0);
      }
      if (sortBy === 'behaviour') {
        return (a.behaviour || '').localeCompare(b.behaviour || '');
      }
      return 0;
    });
  }, [filteredEvents, sortBy]);

  const toggleSelect = (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]
    );
  };

  const isAllSelected = sortedAndFilteredEvents.length > 0 && sortedAndFilteredEvents.every(ev => selectedIds.includes(ev.event_id));

  const handleSelectAllToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedAndFilteredEvents.map(ev => ev.event_id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0 || isBatchOperating) return;
    setIsBatchOperating(true);
    try {
      const idsToDelete = [...selectedIds];
      await batchDeleteIncidents(idsToDelete);
      setLocalEvents(prev => prev.filter(item => !idsToDelete.includes(item.event_id)));
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to execute batch deletion:', err);
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleBatchAcknowledge = async () => {
    if (selectedIds.length === 0 || isBatchOperating) return;
    setIsBatchOperating(true);
    try {
      const idsToAck = [...selectedIds];
      await batchUpdateIncidentStatus(idsToAck, 'ACKNOWLEDGED');
      const ackUser = user?.email || user?.id || 'operator';
      setLocalEvents(prev =>
        prev.map(item =>
          idsToAck.includes(item.event_id)
            ? {
                ...item,
                status: 'ACKNOWLEDGED',
                acknowledged_by_user_id: ackUser,
                acknowledged_at: new Date().toISOString()
              }
            : item
        )
      );
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to execute batch acknowledge:', err);
    } finally {
      setIsBatchOperating(false);
    }
  };

  const handleExportCSV = async () => {
    if (isExporting || sortedAndFilteredEvents.length === 0) return;
    setIsExporting(true);

    try {
      const filterParams: Record<string, any> = {
        limit: 5000,
      };
      if (selectedRisk && selectedRisk !== 'All') {
        filterParams.risk_level = selectedRisk;
      }
      if (selectedBay && selectedBay !== 'All') {
        filterParams.bay_id = selectedBay;
      }
      if (searchQuery.trim()) {
        filterParams.search = searchQuery.trim();
      }

      const blob = await exportEventsCsv(filterParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `warehouse_incidents_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export incident reports:', err);
      // Fallback to client-side comprehensive CSV export if backend endpoint fails
      exportComprehensiveEventsCsv(sortedAndFilteredEvents);
    } finally {
      setIsExporting(false);
    }
  };

  const handleGeneratePdfReport = () => {
    generateSafetyAuditPdfReport(sortedAndFilteredEvents);
  };

  if (loading) {
    return (
      <div className={`bg-white p-6 border border-slate-200 rounded-xl min-h-[400px] flex items-center justify-center ${className || ''}`}>
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && localEvents.length === 0) {
    return (
      <div className={`bg-white p-8 text-center min-h-[400px] flex flex-col items-center justify-center gap-3 border border-slate-200 rounded-xl text-slate-900 ${className || ''}`}>
        <ShieldAlert className="w-8 h-8 text-red-600" />
        <p className="text-sm font-bold text-slate-900">Failed to load incident records</p>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 px-3.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  const riskOptions = ['All', 'Critical', 'High', 'Medium', 'Low'];

  return (
    <div className={`bg-white border border-slate-200 rounded-xl text-slate-900 shadow-2xs overflow-hidden flex flex-col relative ${className || 'h-[680px]'}`}>
      {/* Header & Filters Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-white space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllToggle}
              className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title={isAllSelected ? "Deselect All" : "Select All Filtered Incidents"}
            >
              {isAllSelected ? (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Incident Review Queue</h2>
              <p className="text-xs text-slate-500">Detected material-handling events requiring supervisor intervention</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {sortedAndFilteredEvents.length} {sortedAndFilteredEvents.length === 1 ? 'incident' : 'incidents'}
            </span>

            <button
              type="button"
              onClick={handleGeneratePdfReport}
              disabled={sortedAndFilteredEvents.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-all cursor-pointer disabled:opacity-50"
              title="Generate Printable Safety Audit Compliance Report"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Audit Report PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={sortedAndFilteredEvents.length === 0 || isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <Download className="w-3.5 h-3.5 text-slate-600" />}
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Risk Level Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
            {riskOptions.map((risk) => (
              <button
                key={risk}
                onClick={() => handleRiskChange(risk)}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedRisk === risk
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {risk}
              </button>
            ))}
          </div>

          {/* Search bar & Bay selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search behaviour, ID, bay..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="highest-risk">Highest Risk</option>
              <option value="lowest-risk">Lowest Risk</option>
              <option value="behaviour">Behaviour (A-Z)</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Scannable Incident List Rows */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#F5F7FA] pb-20">
        <AnimatePresence>
          {sortedAndFilteredEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full min-h-[250px] flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2 bg-white rounded-xl border border-slate-200"
            >
              <ShieldAlert className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">No high-risk events matching current filter</p>
              <p className="text-xs text-slate-500">AI monitoring active across all loading bays.</p>
              <button
                onClick={handleResetFilters}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer mt-1"
              >
                Reset filters
              </button>
            </motion.div>
          ) : (
            sortedAndFilteredEvents.map((event, idx) => {
              const statusUpper = (event.status || 'UNRESOLVED').toUpperCase();
              const isAcknowledged = statusUpper === 'ACKNOWLEDGED';
              const isSelected = selectedIds.includes(event.event_id);

              return (
                <Link
                  key={event.event_id}
                  to={`/incident/${event.event_id}`}
                  className="block group"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                    className={`p-3.5 rounded-xl bg-white hover:bg-slate-50 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                      isSelected ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Left: Checkbox & Incident Meta */}
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => toggleSelect(e, event.event_id)}
                        className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <RiskBadge level={event.risk_level} />
                          <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {event.behaviour}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            Score: {event.risk_score}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate flex items-center gap-2 font-mono">
                          <span>{event.bay_id || 'Loading Bay 01'}</span>
                          <span>·</span>
                          <span>{event.camera_id || 'Camera 02'}</span>
                          <span>·</span>
                          <span>{formatTimestamp(event.timestamp)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="text-xs text-slate-500 font-mono hidden md:inline">
                        Conf: 94%
                      </span>

                      {isAcknowledged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Acknowledged
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleAcknowledge(e, event.event_id)}
                          disabled={acknowledgingIds[event.event_id]}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {acknowledgingIds[event.event_id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <AlertOctagon className="w-3.5 h-3.5" />
                          )}
                          <span>Acknowledge</span>
                        </button>
                      )}

                      <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center ml-1">
                        Review <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </motion.div>
                </Link>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Bar (FAB) for Multi-Select Bulk Actions */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-4 flex-wrap sm:flex-nowrap border border-slate-800"
          >
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <span className="text-white font-black text-sm">{selectedIds.length}</span>
              <span className="text-slate-300">{selectedIds.length === 1 ? 'incident selected' : 'incidents selected'}</span>
            </div>

            <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchAcknowledge}
                disabled={isBatchOperating}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isBatchOperating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Acknowledge Selected</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={isBatchOperating}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isBatchOperating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Selected</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                disabled={isBatchOperating}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
