import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, TrendingUp, Zap } from 'lucide-react';
import type { FrameTelemetryPoint } from '../types/telemetry';

export interface RiskTimelineChartProps {
  timelineData: FrameTelemetryPoint[];
  currentTime?: number;
  compositeRiskScore?: number;
  peakRisk?: number;
  onDataPointClick?: (seconds: number) => void;
  className?: string;
}

export const RiskTimelineChart: React.FC<RiskTimelineChartProps> = ({
  timelineData,
  currentTime = 0,
  compositeRiskScore = 85.0,
  peakRisk = 94.6,
  onDataPointClick,
  className,
}) => {
  const roundedCurrentTime = Math.round(currentTime);

  const chartData = timelineData.map((point) => ({
    time: point.time,
    timeLabel: `${point.time}s`,
    risk: point.frameRisk,
    event: point.event || 'Normal Handling Stream',
    acceleration: point.accelerationY,
    velocity: point.velocityHorizontal,
  }));

  const activePoint = timelineData.find((p) => p.time === roundedCurrentTime);

  return (
    <div className={`glass-panel p-5 bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl shadow-xl space-y-3 ${className || ''}`}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Frame-by-Frame Kinematic Risk Timeline R(t)
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Temporal Sequence Risk Accumulation: R_video = 0.7 · max(R_t) + 0.3 · mean(R_k)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-slate-400">Peak R(t):</span>
            <span className="font-mono font-bold text-rose-400">{peakRisk.toFixed(1)}%</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/80">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300">Composite R_video:</span>
            <span className="font-mono font-bold text-emerald-400">{compositeRiskScore.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Active Timecode Event Banner */}
      {activePoint?.event && (
        <div className="bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-xl text-xs flex items-center justify-between text-rose-200 animate-pulse">
          <span className="font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Active Incident at {activePoint.time}s: {activePoint.event}
          </span>
          <span className="font-mono text-[10px] bg-rose-900/60 px-2 py-0.5 rounded border border-rose-500/50">
            R(t): {activePoint.frameRisk}%
          </span>
        </div>
      )}

      {/* Recharts Area Chart */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload[0] && onDataPointClick) {
                const targetTime = state.activePayload[0].payload.time;
                onDataPointClick(targetTime);
              }
            }}
          >
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.85} />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            
            <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 shadow-2xl text-xs font-mono space-y-1">
                      <p className="font-bold text-slate-200">Timecode: {data.time}s</p>
                      <p className="text-rose-400 font-bold">Risk Score R(t): {data.risk}%</p>
                      {data.event && <p className="text-amber-300 text-[11px] font-sans">{data.event}</p>}
                      <p className="text-slate-400 text-[10px]">Click data point to seek video here</p>
                    </div>
                  );
                }
                return null;
              }}
            />

            <ReferenceLine y={35} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Baseline (35)', fill: '#f59e0b', fontSize: 9 }} />
            <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Critical Threshold (80)', fill: '#f43f5e', fontSize: 9 }} />
            
            {/* Active Video Playback Position Reference Line */}
            <ReferenceLine 
              x={`${roundedCurrentTime}s`} 
              stroke="#10b981" 
              strokeWidth={2} 
              label={{ value: `▶ ${roundedCurrentTime}s`, fill: '#10b981', fontSize: 10, position: 'top' }} 
            />

            <Area type="monotone" dataKey="risk" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#riskGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
        <span className="flex items-center gap-1">
          💡 <strong className="text-slate-300">Bi-Directional Scrubbing:</strong> Click any peak node on graph to jump video to that frame.
        </span>
        <span className="font-mono text-slate-400">YOLO11 Sub-12ms Kinematic Telemetry</span>
      </div>
    </div>
  );
};

export default RiskTimelineChart;
