import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useEvents } from '../hooks/useEvents';
import { exportEventsCsv, acknowledgeIncident, dispatchIncident, batchDeleteIncidents, batchUpdateIncidentStatus } from '../api/events';
import { exportComprehensiveEventsCsv, generateSafetyAuditPdfReport } from '../utils/reportExporter';
import { RiskBadge } from './RiskBadge';
import { formatTimestamp, extractVideoOffsetSeconds } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  X, 
  ShieldAlert, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertOctagon, 
  Trash2, 
  CheckSquare, 
  Square, 
  FileText,
  Play,
  RotateCcw,
  ExternalLink,
  Send,
  Truck,
  Camera,
  Eye
} from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { IncidentReviewModal } from './IncidentReviewModal';
import type { Event } from '../types/event';

const VALID_RISKS = ['Medium+', 'All', 'Critical', 'High', 'Medium', 'Low'];

export type SortOption = 'newest' | 'highest-risk' | 'lowest-risk' | 'behaviour';

export interface EventListProps {
  className?: string;
}

export const EventList: React.FC<EventListProps> = ({ className }) => {
  const { events: fetchedEvents, loading, error, refetch } = useEvents();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [localEvents, setLocalEvents] = useState<Event[]>([]);
  const [acknowledgingIds, setAcknowledgingIds] = useState<Record<string, boolean>>({});
  const [dispatchingIds, setDispatchingIds] = useState<Record<string, boolean>>({});

  // Multi-select & Batch Operation States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchOperating, setIsBatchOperating] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const hasAttemptedAutoIngestRef = useRef<boolean>(false);

  // Video Evidence Player Modal State
  const [activeVideoModal, setActiveVideoModal] = useState<{
    event: Event;
    videoUrl: string;
    timestampSec: number;
  } | null>(null);

  // HITL Review Modal State
  const [reviewModalEvent, setReviewModalEvent] = useState<Event | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setLocalEvents(fetchedEvents);
  }, [fetchedEvents]);

  // One-time auto-seed attempt if 0 events found on initial mount
  useEffect(() => {
    if (!loading && fetchedEvents.length === 0 && !error && !hasAttemptedAutoIngestRef.current) {
      hasAttemptedAutoIngestRef.current = true;
      handleAutoIngestTrajectories();
    }
  }, [loading, fetchedEvents.length, error]);

  const handleAutoIngestTrajectories = async () => {
    hasAttemptedAutoIngestRef.current = true;
    setIsSeeding(true);
    try {
      await apiClient.post('/pipeline/ingest-all-warehouse-trajectories');
      await refetch();
    } catch (e) {
      console.warn('Auto-ingest pipeline fallback notice:', e);
    } finally {
      setIsSeeding(false);
    }
  };

  const riskFromUrl = useMemo(() => {
    const rawRisk = searchParams.get('risk');
    if (!rawRisk) return 'Medium+';
    const cleanRisk = rawRisk.trim();
    if (cleanRisk.toLowerCase() === 'medium+' || cleanRisk.toLowerCase() === 'operational') return 'Medium+';
    const match = VALID_RISKS.find(r => r.toLowerCase() === cleanRisk.toLowerCase());
    return match || 'Medium+';
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
    if (risk === 'Medium+') {
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

  const handleDispatch = async (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (dispatchingIds[eventId]) return;
    setDispatchingIds(prev => ({ ...prev, [eventId]: true }));

    try {
      await dispatchIncident(eventId);
      setLocalEvents(prev =>
        prev.map(item =>
          item.event_id === eventId
            ? {
                ...item,
                status: 'DISPATCHED'
              }
            : item
        )
      );
    } catch (err) {
      console.error('Failed to dispatch incident:', err);
    } finally {
      setDispatchingIds(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const handleOpenVideoClip = (e: React.MouseEvent, event: Event) => {
    e.preventDefault();
    e.stopPropagation();

    let rawUrl = event.evidence_frame || event.video_reference || '';
    let timestampSec = 0;

    if (rawUrl.includes('#t=')) {
      const parts = rawUrl.split('#t=');
      rawUrl = parts[0];
      timestampSec = parseFloat(parts[1]) || 0;
    } else if (event.timestamp != null) {
      timestampSec = Number(event.timestamp) || 0;
    }

    if (!rawUrl || !rawUrl.endsWith('.mp4')) {
      const beh = (event.behaviour || '').toLowerCase();
      if (beh.includes('drop')) {
        rawUrl = '/videos/Rolling%20and%20dropping%20carton.mp4';
      } else if (beh.includes('drag')) {
        rawUrl = '/videos/Dock%20level%2C%20dragging%20cupboard.mp4';
      } else if (beh.includes('stack')) {
        rawUrl = '/videos/Improper%20stacking.mp4';
      } else if (beh.includes('mattress')) {
        rawUrl = '/videos/throwing%20mattresses.mp4';
      } else if (beh.includes('step')) {
        rawUrl = '/videos/Stepping%20on%20carton.mp4';
      } else {
        rawUrl = '/videos/Rolling%20and%20dropping%20carton.mp4';
      }
    }

    setActiveVideoModal({
      event,
      videoUrl: rawUrl,
      timestampSec
    });
  };

  const filteredEvents = useMemo(() => {
    return localEvents.filter(e => {
      let matchRisk = false;
      const levelUpper = (e.risk_level || '').toUpperCase();
      const score = e.risk_score ?? 0;

      if (selectedRisk === 'Medium+' || selectedRisk === 'Operational') {
        matchRisk = levelUpper === 'MEDIUM' || levelUpper === 'HIGH' || levelUpper === 'CRITICAL' || score >= 35;
      } else if (selectedRisk === 'All') {
        matchRisk = true;
      } else {
        matchRisk = levelUpper === selectedRisk.toUpperCase();
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
      exportComprehensiveEventsCsv(sortedAndFilteredEvents);
    } finally {
      setIsExporting(false);
    }
  };

  const handleGeneratePdfReport = () => {
    generateSafetyAuditPdfReport(sortedAndFilteredEvents);
  };

  if (loading && localEvents.length === 0) {
    return (
      <div className={`bg-white p-6 border border-slate-200 rounded-2xl min-h-[400px] flex flex-col items-center justify-center gap-3 ${className || ''}`}>
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Loading warehouse incident intelligence queue...</p>
      </div>
    );
  }

  if (error && localEvents.length === 0) {
    return (
      <div className={`bg-white p-8 text-center min-h-[400px] flex flex-col items-center justify-center gap-3 border border-slate-200 rounded-2xl text-slate-900 ${className || ''}`}>
        <ShieldAlert className="w-8 h-8 text-red-600" />
        <p className="text-sm font-bold text-slate-900">Failed to load incident records</p>
        <p className="text-xs text-slate-500">{error}</p>
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={handleAutoIngestTrajectories}
            className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            Sync Trajectory Feeds
          </button>
        </div>
      </div>
    );
  }

  const riskOptions = ['Medium+', 'All', 'Critical', 'High', 'Medium', 'Low'];

  return (
    <div className={`bg-white border border-slate-200 rounded-xl text-slate-900 shadow-2xs overflow-hidden flex flex-col relative ${className || 'min-h-[450px] lg:h-[calc(100dvh-200px)]'}`}>
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
              <h2 className="text-base font-bold text-slate-900">AI Incident Review & Video Evidence Queue</h2>
              <p className="text-xs text-slate-500">Real-time detected material-handling violations with kinematic evidence and corrective dispatch</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoIngestTrajectories}
              disabled={isSeeding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
              title="Sync & Ingest All Warehouse Trajectory Feeds"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-slate-600 ${isSeeding ? 'animate-spin' : ''}`} />
              <span>{isSeeding ? 'Syncing...' : 'Sync Video Feeds'}</span>
            </button>

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
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search behaviour, ID, bay, reason..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
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
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
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
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#F5F7FA] pb-24">
        <AnimatePresence>
          {sortedAndFilteredEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3 bg-white rounded-2xl border border-slate-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">No Incidents Matching Current Filter</p>
                <p className="text-xs text-slate-500 mt-0.5">AI optical monitoring active across all warehouse loading bays.</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleAutoIngestTrajectories}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Sync & Ingest 7 Warehouse Video Trajectories
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            </motion.div>
          ) : (
            sortedAndFilteredEvents.map((event, idx) => {
              const statusUpper = (event.status || 'UNRESOLVED').toUpperCase();
              const isAcknowledged = statusUpper === 'ACKNOWLEDGED';
              const isDispatched = statusUpper === 'DISPATCHED';
              const isSelected = selectedIds.includes(event.event_id);
              const tSec = extractVideoOffsetSeconds(event).toFixed(1);

              return (
                <div
                  key={event.event_id}
                  className="block group"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                    className={`p-4 rounded-2xl bg-white hover:bg-slate-50/80 border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Left: Checkbox, Video Evidence Preview Thumbnail, Title */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => toggleSelect(e, event.event_id)}
                        className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0 mt-1 sm:mt-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </button>

                      {/* Video Evidence Timecode Thumbnail Pill */}
                      <div
                        onClick={(e) => handleOpenVideoClip(e, event)}
                        className="relative w-28 h-18 sm:w-32 sm:h-20 bg-slate-950 rounded-xl overflow-hidden shrink-0 border border-slate-300 group/thumb cursor-pointer shadow-2xs"
                        title="Click to play incident video clip @ timestamp"
                      >
                        <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-transparent to-transparent z-10" />
                        <div className="absolute inset-0 flex items-center justify-center z-20 group-hover/thumb:scale-110 transition-transform">
                          <span className="w-7 h-7 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-lg">
                            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                          </span>
                        </div>
                        <span className="absolute bottom-1 right-1.5 z-20 text-[10px] font-mono font-bold bg-slate-900/90 text-blue-400 px-1.5 py-0.2 rounded border border-slate-700">
                          t={tSec}s
                        </span>
                      </div>

                      {/* Incident Content & Metadata */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <RiskBadge level={event.risk_level} />
                          <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {event.behaviour || 'Kinematic Hazard Detected'}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Risk: {event.risk_score ? `${event.risk_score}%` : 'High'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            {event.event_id}
                          </span>
                        </div>

                        {/* Location, Camera, Time */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono flex-wrap">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            {event.bay_id || 'Loading Bay 01'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-slate-400" />
                            {event.camera_id || 'CAM-01'}
                          </span>
                          <span>•</span>
                          <span>{formatTimestamp(event.timestamp)}</span>
                        </div>

                        {/* Reason / Kinematic Callout */}
                        <p className="text-xs text-slate-600 line-clamp-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                          <strong className="text-slate-800">Observation: </strong>
                          {event.description || event.reason || 'Rapid velocity deceleration spike detected.'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Supervisor Actions & Details CTA */}
                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReviewModalEvent(event);
                          setIsReviewModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review Incident</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleOpenVideoClip(e, event)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-blue-600" />
                        <span>Play Evidence</span>
                      </button>

                      {isAcknowledged ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Acknowledged
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleAcknowledge(e, event.event_id)}
                          disabled={acknowledgingIds[event.event_id]}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {acknowledgingIds[event.event_id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <AlertOctagon className="w-3.5 h-3.5" />
                          )}
                          <span>Acknowledge</span>
                        </button>
                      )}

                      {isDispatched ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Send className="w-3.5 h-3.5 text-indigo-600" /> Dispatched
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDispatch(e, event.event_id)}
                          disabled={dispatchingIds[event.event_id]}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {dispatchingIds[event.event_id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>Dispatch</span>
                        </button>
                      )}

                      <Link
                        to={`/incident/${event.event_id}`}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-blue-600 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
                      >
                        <span>Dossier</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </motion.div>
                </div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Video Evidence Modal */}
      <AnimatePresence>
        {activeVideoModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-blue-600 px-2 py-0.5 rounded">
                      {activeVideoModal.event.event_id}
                    </span>
                    <h3 className="text-sm font-bold truncate">{activeVideoModal.event.behaviour}</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {activeVideoModal.event.bay_id || 'Loading Bay 01'} • Camera: {activeVideoModal.event.camera_id || 'CAM-01'} • Timecode: t={activeVideoModal.timestampSec.toFixed(1)}s
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveVideoModal(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video Player */}
              <div className="relative aspect-video w-full bg-black">
                <video
                  src={activeVideoModal.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                  onLoadedMetadata={(e) => {
                    const videoEl = e.currentTarget;
                    if (activeVideoModal.timestampSec > 0) {
                      videoEl.currentTime = Math.max(0, activeVideoModal.timestampSec - 1.0);
                    }
                  }}
                />
              </div>

              {/* Modal Details & Action */}
              <div className="p-4 bg-white space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">AI Kinematic Diagnostic:</span>
                    <span className="font-mono font-bold text-red-600">
                      Score: {activeVideoModal.event.risk_score ?? 92.5}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {activeVideoModal.event.reason || activeVideoModal.event.description}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveVideoModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const vTitle = activeVideoModal.videoUrl.split('/').pop() || '';
                      navigate(`/?video=${encodeURIComponent(vTitle)}`);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Launch Deep Optical Analysis</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Bar (FAB) for Multi-Select Bulk Actions */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-50 bg-white text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 flex-wrap sm:flex-nowrap border border-slate-200"
          >
            <div className="flex items-center gap-2 text-xs font-bold font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
              <span className="text-slate-900 font-black text-sm">{selectedIds.length}</span>
              <span className="text-slate-600">{selectedIds.length === 1 ? 'incident selected' : 'incidents selected'}</span>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchAcknowledge}
                disabled={isBatchOperating}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isBatchOperating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Acknowledge Selected</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={isBatchOperating}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isBatchOperating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Selected</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HITL Incident Review Modal */}
      <IncidentReviewModal
        event={reviewModalEvent}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onStatusUpdated={(updated) => {
          setLocalEvents((prev) => prev.map((e) => (e.event_id === updated.event_id ? updated : e)));
          setIsReviewModalOpen(false);
        }}
      />
    </div>
  );
};
