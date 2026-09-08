import React, { useState, useMemo } from 'react';
import { useEvents } from '../hooks/useEvents';
import { exportEventsCsv } from '../api/events';
import { RiskBadge } from './RiskBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Video, ChevronRight, Search, Filter, X, ShieldAlert, Download, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

const VALID_RISKS = ['All', 'Critical', 'High', 'Medium', 'Low', 'Medium/Low'];

export type SortOption = 'newest' | 'highest-risk' | 'lowest-risk' | 'behaviour';

export interface EventListProps {
  className?: string;
}

export const EventList: React.FC<EventListProps> = ({ className }) => {
  const { events, loading, error, refetch } = useEvents();
  const [searchParams, setSearchParams] = useSearchParams();

  // Normalize risk from URL search parameters (?risk=Critical or ?risk=Medium/Low)
  const riskFromUrl = useMemo(() => {
    const rawRisk = searchParams.get('risk');
    if (!rawRisk) return 'All';
    const cleanRisk = rawRisk.trim();
    if (cleanRisk.toLowerCase() === 'medium,low' || cleanRisk.toLowerCase() === 'medium/low') {
      return 'Medium/Low';
    }
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

  // Sync state if URL search parameters change externally (e.g. clicking a chart bar)
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

  // Extract unique bays from events
  const uniqueBays = useMemo(() => {
    const bays = new Set<string>();
    events.forEach(e => {
      if (e.bay_id) bays.add(e.bay_id);
    });
    return Array.from(bays).sort();
  }, [events]);

  // Filter events client-side for ultra-responsive feedback
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      let matchRisk = selectedRisk === 'All';
      if (!matchRisk) {
        if (selectedRisk === 'Medium/Low') {
          const r = (e.risk_level || '').toLowerCase();
          matchRisk = r === 'medium' || r === 'low';
        } else {
          matchRisk = (e.risk_level || '').toLowerCase() === selectedRisk.toLowerCase();
        }
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
  }, [events, selectedRisk, selectedBay, searchQuery]);

  // Sort events based on selected sort option
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
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className={`glass-panel p-6 min-h-[400px] flex items-center justify-center ${className || ''}`}>
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={`glass-panel p-8 text-center min-h-[400px] flex flex-col items-center justify-center gap-3 ${className || ''}`}>
        <ShieldAlert className="w-8 h-8 text-rose-500" />
        <p className="text-sm font-semibold text-slate-800">Failed to load incident records</p>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 px-3.5 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-blue-700 btn-interactive"
        >
          Retry
        </button>
      </div>
    );
  }

  const riskOptions = ['All', 'Critical', 'High', 'Medium', 'Low'];

  return (
    <div className={`glass-panel p-0 overflow-hidden flex flex-col ${className || 'h-[650px]'}`}>
      {/* Header & Filter Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Incident Feed</h2>
            <p className="text-xs text-slate-500">Real-time timeline of detected behaviours and violations</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 w-fit">
              {sortedAndFilteredEvents.length} {sortedAndFilteredEvents.length === 1 ? 'incident' : 'incidents'}
            </span>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={sortedAndFilteredEvents.length === 0 || isExporting}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 hover:text-primary text-xs font-semibold rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
              title="Export current filtered incidents as CSV"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Filter controls row */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by event, behaviour, ID..."
              aria-label="Search incidents by event, behaviour, ID"
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Bay selector */}
            {uniqueBays.length > 0 && (
              <div className="relative min-w-[110px] flex-1 sm:flex-none">
                <select
                  value={selectedBay}
                  onChange={(e) => setSelectedBay(e.target.value)}
                  aria-label="Filter incidents by bay"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
                >
                  <option value="All">All Bays</option>
                  {uniqueBays.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort selector */}
            <div className="relative min-w-[125px] flex-1 sm:flex-none">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
                aria-label="Sort incidents"
              >
                <option value="newest">Newest First</option>
                <option value="highest-risk">Highest Risk</option>
                <option value="lowest-risk">Lowest Risk</option>
                <option value="behaviour">Behaviour (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Risk Level Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
          {riskOptions.map((risk) => (
            <button
              key={risk}
              onClick={() => handleRiskChange(risk)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all shrink-0 cursor-pointer ${
                selectedRisk === risk
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>
      </div>
      
      {/* Scrollable Event Rows */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <AnimatePresence>
          {sortedAndFilteredEvents.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full min-h-[250px] flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2"
            >
              <ShieldAlert className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No incidents match the selected filters</p>
              <button
                onClick={handleResetFilters}
                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
              >
                Reset all filters
              </button>
            </motion.div>
          ) : (
            sortedAndFilteredEvents.map((event, idx) => (
              <Link
                key={event.event_id}
                to={`/incident/${event.event_id}`}
                className="block group"
              >
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                  className="p-4 rounded-xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-primary/40 hover:shadow-md active:scale-[0.99] transition-all flex flex-col gap-2.5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-900 font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-2">
                        {event.behaviour}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.timestamp}s</span>
                        <span>•</span>
                        <span>{event.bay_id || 'Unassigned Bay'}</span>
                        <span>•</span>
                        <span>{event.camera_id || 'CAM-01'}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RiskBadge level={event.risk_level} />
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {event.risk_score}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {event.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Video className="w-3 h-3 text-slate-400" /> {event.camera_id || 'CAM-01'}
                      <span className="text-slate-300">•</span>
                      <span className="font-semibold text-slate-700">{event.event_id}</span>
                    </span>
                    <span className="text-primary font-medium flex items-center group-hover:translate-x-0.5 transition-transform">
                      Investigate <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </motion.div>
              </Link>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
