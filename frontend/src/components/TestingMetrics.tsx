import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Clock, Zap, Target, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import { DataProvenanceOverlay } from './DataProvenanceOverlay';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  badge?: string;
  icon: React.ReactNode;
  trend?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, badge, icon, trend }) => (
  <div className="glass-panel p-5 relative overflow-hidden">
    <div className="flex items-start justify-between">
      <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      {badge && (
        <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          {badge}
        </span>
      )}
    </div>
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h4>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-black text-slate-900">{value}</span>
        {trend && <span className="text-xs font-bold text-emerald-600">{trend}</span>}
      </div>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  </div>
);

export const TestingMetrics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>('/ml/metrics/evaluation');
      setData(res);
      setError(null);
    } catch (err: any) {
      console.warn('Failed to fetch ML telemetry:', err);
      setError('Unable to fetch live model telemetry metrics from inference node.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTelemetry();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> Loading live model performance metrics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>Live ML Telemetry Unavailable</span>
        </div>
        <p className="text-xs text-amber-800">{error || 'No telemetry dataset available.'}</p>
        <button
          onClick={fetchTelemetry}
          className="px-4 py-2 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const sampleCount = data?.in_distribution?.sample_count ?? 0;
  const hasObs = sampleCount > 0;

  const mapScore = hasObs && data?.in_distribution?.mean_average_precision != null
    ? `${(data.in_distribution.mean_average_precision * 100).toFixed(1)}%`
    : 'N/A — insufficient observations';

  const precScore = hasObs && data?.in_distribution?.precision != null
    ? `${(data.in_distribution.precision * 100).toFixed(1)}%`
    : 'N/A — insufficient observations';

  const recScore = hasObs && data?.in_distribution?.recall != null
    ? `${(data.in_distribution.recall * 100).toFixed(1)}%`
    : 'N/A — insufficient observations';

  const latencyStr = hasObs && data?.in_distribution?.inference_latency_ms != null
    ? `${data.in_distribution.inference_latency_ms.toFixed(1)} ms`
    : 'N/A — insufficient observations';

  return (
    <DataProvenanceOverlay endpoint="GET /api/ml/metrics/evaluation" entity="evaluation_datasets">
      <div className="space-y-6 p-4">
        {/* Header Banner */}
        <div className="glass-panel p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-primary/90 text-white rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Live In-Production Performance Benchmarks
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                {data.model_version || 'YOLO11s'} & Behaviour Engine Validation
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Telemetry evaluated on {sampleCount} ground-truth telemetry observations across active loading bay cameras.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-slate-400 block">mAP@0.5:0.95</span>
                <span className="text-2xl font-black text-emerald-400">{mapScore}</span>
              </div>
              <div className="h-8 w-px bg-slate-700" />
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Mean Latency</span>
                <span className="text-2xl font-black text-white">{latencyStr}</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Model mAP@0.5"
            value={mapScore}
            subtitle={`Evaluated on dataset: ${data.in_distribution?.dataset_name || 'DS-ALPHA'}`}
            badge={hasObs ? "Live Telemetry" : "No Samples"}
            icon={<Target className="w-5 h-5" />}
          />
          <MetricCard
            title="Precision"
            value={precScore}
            subtitle="True Positives / Total Positives"
            badge="Live Telemetry"
            icon={<Zap className="w-5 h-5" />}
          />
          <MetricCard
            title="Recall"
            value={recScore}
            subtitle="True Positives / Ground Truth Positives"
            badge="Live Telemetry"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <MetricCard
            title="Inference Latency"
            value={latencyStr}
            subtitle="Real-time frame pipeline processing duration"
            badge="Pipeline Telemetry"
            icon={<Clock className="w-5 h-5" />}
          />
        </div>

        {/* Class Performance Table */}
        {data.class_performance && data.class_performance.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Class-Level Validation Benchmarks
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Behaviour Class</th>
                  <th className="px-6 py-3">F1 Score</th>
                  <th className="px-6 py-3">Support (Sample Count)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.class_performance.map((cls: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3.5 font-semibold text-slate-800">{cls.class}</td>
                    <td className="px-6 py-3.5 font-mono font-bold text-emerald-600">{(cls.f1_score * 100).toFixed(1)}%</td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">{cls.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
            N/A — insufficient observations for class-level benchmarks.
          </div>
        )}
      </div>
    </DataProvenanceOverlay>
  );
};
