import React, { useState, useEffect } from 'react';
import { SummaryCards } from '../components/SummaryCards';
import { RiskChart } from '../components/RiskChart';
import { BehaviourChart } from '../components/BehaviourChart';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAnalytics } from '../hooks/useAnalytics';
import { getLoadingBays, type LoadingBay } from '../api/facilities';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  Truck, 
  ArrowRight, 
  BookOpen,
  Loader2,
  AlertTriangle
} from 'lucide-react';

import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';

export const Dashboard: React.FC = () => {
  const { analytics, error: analyticsError, refetch } = useAnalytics();
  const [bays, setBays] = useState<LoadingBay[]>([]);
  const [baysLoading, setBaysLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getLoadingBays()
      .then((data) => {
        if (!isMounted) return;
        setBays(data);
      })
      .catch((err) => console.warn('Failed to load loading bays:', err))
      .finally(() => {
        if (isMounted) setBaysLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const hasObservations = analytics.summary.totalEvents > 0;
  const preventionIndexStr = hasObservations && analytics.summary.preventionIndex != null
    ? `${analytics.summary.preventionIndex.toFixed(1)} / 100`
    : 'N/A — insufficient observations';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1440px] mx-auto space-y-6 text-slate-900"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" /> Warehouse Behaviour Intelligence
          </h1>
          <p className="text-sm text-slate-500">
            Analyze handling risk patterns, loading bay trends, and actionable damage prevention opportunities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/behaviour-library"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 btn-interactive shadow-2xs"
          >
            <BookOpen className="w-4 h-4 text-blue-600" /> Behaviour Taxonomy
          </Link>
          <Link
            to="/incidents"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold btn-interactive shadow-2xs"
          >
            Incident Queue <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {analyticsError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Unable to load operational analytics: {analyticsError}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hero Business Metric: DAMAGE PREVENTION INDEX */}
      <DataProvenanceOverlay endpoint="GET /api/analytics/summary" entity="events" filter="facility_id=FAC-001">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                HERO BUSINESS METRIC
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <h2 className="text-3xl font-black font-mono text-slate-900">
                  DAMAGE PREVENTION INDEX
                </h2>
                <span className="text-2xl font-bold font-mono text-emerald-600">
                  {preventionIndexStr}
                </span>
                {hasObservations && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <TrendingUp className="w-3.5 h-3.5" /> Proactive AI Shield Active
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 max-w-[280px]">
              Index measures proactive AI risk detections, supervisor interventions, and reduction in repeat high-risk behaviors.
            </div>
          </div>

          {/* Supporting Damage Prevention KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-slate-500 font-medium">Critical Risk Incidents</p>
                <p className="text-lg font-bold text-emerald-600 font-mono mt-0.5 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" /> {analytics.summary.criticalEvents} active
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Shift summary</span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-slate-500 font-medium">Repeat Behaviour</p>
                <p className="text-lg font-bold text-emerald-600 font-mono mt-0.5 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" /> ↓ {analytics.summary.repeatBehaviourPct}%
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Operator feedback</span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-slate-500 font-medium">Resolved Incidents</p>
                <p className="text-lg font-bold text-emerald-600 font-mono mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> {analytics.summary.resolvedIncidents} resolved
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Database verified</span>
            </div>
          </div>
        </div>
      </DataProvenanceOverlay>

      {/* Summary Operational Cards */}
      <SummaryCards />
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskChart />
        <BehaviourChart />
      </div>

      {/* Loading Bay Health & Prevention Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Loading Bay Health Grid */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" /> Loading Bay Operational Health
            </h3>
            <span className="text-xs font-semibold text-slate-500">{bays.length} Loading Bays Monitored</span>
          </div>

          {baysLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Loading operational bays...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {bays.map((b) => (
                <div 
                  key={b.id} 
                  className={`p-4 rounded-xl border space-y-2 ${
                    b.risk_level === 'Critical' || b.risk_level === 'High'
                      ? 'bg-orange-50/60 border-orange-200/80'
                      : b.risk_level === 'Medium'
                      ? 'bg-amber-50/60 border-amber-200/80'
                      : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{b.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                      b.risk_level === 'Critical' || b.risk_level === 'High'
                        ? 'bg-orange-100 text-orange-800'
                        : b.risk_level === 'Medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {b.risk_level} Risk
                    </span>
                  </div>
                  <p className="text-slate-500 font-mono text-[11px]">
                    {b.active_events_count} active events · {b.latest_incident_behaviour || 'Nominal sequence'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prevention Opportunities Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Prevention Opportunities
          </h3>

          <div className="space-y-3 text-xs">
            {analytics.behaviours.length > 0 ? (
              analytics.behaviours.slice(0, 2).map((b, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{b.name}</span>
                    <span className="text-blue-600 font-mono">{b.value} events</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Avg Risk Score: {b.avg_score ? b.avg_score.toFixed(1) : 'N/A'}
                  </p>
                  <div className="pt-1.5 border-t border-slate-200 text-slate-800 font-medium">
                    <strong className="text-blue-900 font-semibold">Recommended: </strong>
                    Conduct ergonomic safety review for {b.name.toLowerCase()} scenarios.
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No prevention opportunities flagged.</p>
            )}
          </div>
        </div>

      </div>

    </motion.div>
  );
};
