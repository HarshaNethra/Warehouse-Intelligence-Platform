import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, AlertTriangle, Activity, Zap, RefreshCw, BarChart2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { motion } from 'framer-motion';

export interface EvaluationData {
  model_version: string;
  evaluation_timestamp: string;
  telemetry_status?: 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'BLOCKED' | 'NOT_IMPLEMENTED' | 'NOT_APPLICABLE';
  status_reason?: string;
  in_distribution: {
    dataset_name: string;
    sample_count: number;
    mean_average_precision: number | null;
    precision: number | null;
    recall: number | null;
    inference_latency_ms: number | null;
    inference_latency_status?: string;
    inference_latency_display?: string;
    false_positive_rate: number | null;
    status?: string;
    source?: string;
  };
  out_of_distribution: {
    dataset_name: string;
    sample_count: number;
    mean_average_precision: number | null;
    precision: number | null;
    recall: number | null;
    inference_latency_ms: number | null;
    inference_latency_status?: string;
    inference_latency_display?: string;
    false_positive_rate: number | null;
    status?: string;
    source?: string;
  };
  class_performance: Array<{
    class: string;
    f1_score: number;
    support: number;
  }>;
}

import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';

const formatPct = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return 'N/A';
  return `${(val * 100).toFixed(1)}%`;
};

export const ModelEvaluation: React.FC = () => {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<EvaluationData>('/ml/metrics/evaluation');
      if (res && res.model_version) {
        setData(res);
      }
      setError(null);
    } catch (err: any) {
      console.warn('Failed to fetch ML metrics:', err);
      setError('Unable to fetch live model telemetry metrics from inference node. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetrics();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> Loading model evaluation metrics...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>Telemetry Unavailable</span>
        </div>
        <p className="text-xs text-amber-800">{error}</p>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-colors"
        >
          Retry Fetching Telemetry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const inDist = data.in_distribution;
  const ood = data.out_of_distribution;

  return (
    <DataProvenanceOverlay endpoint="GET /api/ml/metrics/evaluation" entity="evaluation_datasets">
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1440px] mx-auto space-y-6 text-slate-900 p-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-blue-600" /> ML Model Performance & Generalization
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Computer vision benchmarks comparing trained in-distribution datasets against novel warehouse bay feeds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-2xs">
            Model: <span className="text-blue-600 font-bold">{data.model_version}</span>
          </span>
          <button
            type="button"
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Model Engine Status Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{data.model_version}</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                data.telemetry_status === 'AVAILABLE'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {data.telemetry_status || 'BLOCKED'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              YOLO11 Kinematic Engine • PyTorch 2.4 ONNX Runtime • Temporal Risk Attention
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Trained Samples</span>
            <span className="text-slate-900 font-bold text-sm">{inDist.sample_count.toLocaleString()} frames</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">OOD Test Samples</span>
            <span className="text-slate-900 font-bold text-sm">{ood.sample_count.toLocaleString()} frames</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Inference Latency</span>
            <span className={`font-bold text-xs ${inDist.inference_latency_ms ? 'text-emerald-700' : 'text-amber-700'}`}>
              {inDist.inference_latency_display || (inDist.inference_latency_ms ? `${inDist.inference_latency_ms} ms` : 'Blocked / Insufficient Data')}
            </span>
          </div>
        </div>
      </div>

      {/* Comparison Grid: In-Distribution vs Out-of-Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trained / In-Distribution Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-700 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Trained Dataset (In-Distribution)
            </span>
            <span className="px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-mono font-bold rounded">
              {inDist.dataset_name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wide block mb-1">
                mAP @ 0.5
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-600">
                {formatPct(inDist.mean_average_precision)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wide block mb-1">
                Precision
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900">
                {formatPct(inDist.precision)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wide block mb-1">
                Recall
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900">
                {formatPct(inDist.recall)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wide block mb-1">
                False Positive Rate
              </span>
              <span className="text-xs font-bold font-mono text-slate-500 italic block mt-2">
                {inDist.false_positive_rate !== null ? formatPct(inDist.false_positive_rate) : 'Insufficient data'}
              </span>
            </div>
          </div>
        </div>

        {/* Untrained / Out-of-Distribution Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-700 font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              Untrained Dataset (Out-of-Distribution)
            </span>
            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-mono font-bold rounded">
              {ood.dataset_name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wide block mb-1">
                mAP @ 0.5
              </span>
              <span className="text-xs font-bold font-mono text-slate-500 italic block mt-2">
                {formatPct(ood.mean_average_precision)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wide block mb-1">
                Precision
              </span>
              <span className="text-xs font-bold font-mono text-slate-500 italic block mt-2">
                {formatPct(ood.precision)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wide block mb-1">
                Recall
              </span>
              <span className="text-xs font-bold font-mono text-slate-500 italic block mt-2">
                {formatPct(ood.recall)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wide block mb-1">
                False Positive Rate
              </span>
              <span className="text-xs font-bold font-mono text-slate-500 italic block mt-2">
                {ood.false_positive_rate !== null ? formatPct(ood.false_positive_rate) : 'Insufficient data'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Class F1-Score Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Detection Class Performance Breakdown</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Macro F1 Score Metrics</span>
        </div>

        <div className="space-y-4">
          {data.class_performance.map((item) => {
            const pct = Math.round(item.f1_score * 100);
            return (
              <div key={item.class} className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="font-semibold text-slate-800">{item.class}</span>
                  <span className="text-slate-500">
                    F1: <strong className="text-blue-600">{item.f1_score.toFixed(2)}</strong> ({item.support.toLocaleString()} samples)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct >= 90 ? 'bg-emerald-500' : pct >= 80 ? 'bg-blue-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
    </DataProvenanceOverlay>
  );
};

export default ModelEvaluation;
