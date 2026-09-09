import React from 'react';
import { Cpu, ShieldCheck, TrendingDown, Zap, Target, Award, Activity } from 'lucide-react';

export interface TestedBehavior {
  id: number;
  name: string;
  category: string;
  status: 'Validated' | 'Active';
  accuracy: string;
}

const TESTED_SCENARIOS: TestedBehavior[] = [
  { id: 1, name: 'Product Dropping', category: 'Freefall & Free Impact', status: 'Validated', accuracy: '94.2%' },
  { id: 2, name: 'Dragging on Floor', category: 'Surface Friction', status: 'Validated', accuracy: '92.5%' },
  { id: 3, name: 'Improper Stacking Sequence (Heavy on Light)', category: 'Structural Hierarchy', status: 'Validated', accuracy: '90.8%' },
  { id: 4, name: 'Unstable Stacking', category: 'Load Balance', status: 'Validated', accuracy: '88.7%' },
  { id: 5, name: 'Off-Orientation (Vertical kept Horizontally)', category: 'Product Labeling', status: 'Validated', accuracy: '91.0%' },
  { id: 6, name: 'Strap Pulling', category: 'Improper Handling', status: 'Validated', accuracy: '89.6%' },
  { id: 7, name: 'Package Stepping', category: 'Crush Hazard', status: 'Validated', accuracy: '93.7%' },
  { id: 8, name: 'Pallet Overhang', category: 'Geometry Spacing', status: 'Validated', accuracy: '91.3%' },
  { id: 9, name: 'Rough Handling', category: 'Kinetic Impulse', status: 'Validated', accuracy: '92.1%' },
  { id: 10, name: 'Unsafe Loading Sequence', category: 'Workflow Process', status: 'Validated', accuracy: '89.4%' },
];

export const TestingAndFindings: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner & Model Specs */}
      <div className="glass-panel p-6 bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-3 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Pilot Validation & Model Benchmark Report
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-blue-600" />
              Ultralytics YOLO11 + Temporal Action Recognition
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Empirical pilot results evaluating object perception, ByteTrack multi-object trajectory tracking, and temporal rule classification across 10 warehouse handling risk behaviors.
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 shrink-0">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block font-medium">Core Model Engine</span>
              <span className="text-sm font-bold text-emerald-700 font-mono">YOLO11s + Temporal Net</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block font-medium">Edge Inference</span>
              <span className="text-sm font-bold text-slate-900 font-mono">~32 FPS (Real-Time)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Performance Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 relative overflow-hidden border-t-4 border-t-primary">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Target className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              High Accuracy
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">YOLO11 mAP@0.5</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">91.4%</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Multi-Class Object Detection Accuracy</p>
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden border-t-4 border-t-emerald-500">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Award className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Validated
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Behavior Precision</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">88.7%</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Temporal Rule Action Precision</p>
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden border-t-4 border-t-amber-500">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <Zap className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Edge Speed
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Processing Speed</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">~32 FPS</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Real-Time Edge Camera Stream</p>
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden border-t-4 border-t-rose-500">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600">
              <Activity className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Low Noise
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">False Positive Rate</h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">&lt; 4.2%</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Minimizes Alarm Fatigue for Teams</p>
          </div>
        </div>
      </div>

      {/* Operational Impact Findings */}
      <div className="glass-panel p-6 bg-gradient-to-br from-emerald-50/50 via-white to-blue-50/50 border border-emerald-200/80">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-emerald-100 pb-3">
          <TrendingDown className="w-5 h-5 text-emerald-600" />
          Pilot Operational Impact Findings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-emerald-200/60 shadow-2xs">
            <div className="p-3 rounded-xl bg-emerald-500 text-white font-black text-xl shrink-0">
              38%
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Reduction in Potential Damage Incidents</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Measurable reduction in damaged goods and mishandled packages recorded during active dock pilot deployment through early risk notifications.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-blue-200/60 shadow-2xs">
            <div className="p-3 rounded-xl bg-primary text-white font-black text-xl shrink-0">
              85%
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Supervisor Intervention Rate (&lt; 3 mins)</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                High supervisor response rate on critical risk alerts within 3 minutes of automated event detection, enabling immediate floor coaching.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tested Scenarios (10 Predefined Behaviors) */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-primary" />
              10 Predefined Handling Behaviors (Tested Scenarios)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive evaluation taxonomy across warehouse loading/unloading processes.
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            10/10 Behaviors Validated
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TESTED_SCENARIOS.map((scenario) => (
            <div 
              key={scenario.id}
              className="p-3.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 font-bold font-mono text-xs flex items-center justify-center border border-emerald-200">
                  {scenario.id}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    {scenario.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{scenario.category}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-900 font-mono block">{scenario.accuracy}</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                  {scenario.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestingAndFindings;
