import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, TrendingUp, Zap } from 'lucide-react';
import { getRiskAtTime, type FrameTelemetryPoint } from '../types/telemetry';

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
  peakRisk,
  onDataPointClick,
  className,
}) => {
  const temporalState = getRiskAtTime(timelineData, currentTime);
  const roundedCurrentTime = Math.round(temporalState.currentTime);
  const maxDurationSec = Math.max(5, Math.ceil(temporalState.videoDuration || 60));

  const chartData = timelineData.map((point) => ({
    time: point.time,
    timeLabel: `${point.time}s`,
    risk: point.frameRisk,
    event: point.event || 'Normal Handling Stream',
    acceleration: point.accelerationY,
    velocity: point.velocityHorizontal,
  }));

  const displayPeakPoint = temporalState.peakPoint;

  return (
    <div className={`glass-panel p-5 bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-xs space-y-3 ${className || ''}`}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Frame-by-Frame Kinematic Risk Timeline R(t)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Temporal Sequence Risk Accumulation: R_video = 0.7 · max(R_t) + 0.3 · mean(R_k)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
            <span className="text-slate-500">Peak R(t):</span>
            <span className="font-mono font-bold text-rose-600">{(peakRisk !== undefined ? peakRisk : displayPeakPoint.frameRisk).toFixed(1)}%</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-700">Composite R_video:</span>
            <span className="font-mono font-bold text-emerald-700">{compositeRiskScore.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Active Timecode Event Banner */}
      {temporalState.currentEvent ? (
        <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-xs flex items-center justify-between text-rose-900 animate-pulse">
          <span className="font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            Active Incident at {roundedCurrentTime}s: {temporalState.currentEvent}
          </span>
          <span className="font-mono text-[10px] bg-rose-100 px-2 py-0.5 rounded border border-rose-300 font-bold text-rose-800">
            R(t): {temporalState.currentRisk.toFixed(1)}%
          </span>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Frame {roundedCurrentTime}s: Nominal Handling Stream (Risk R(t): {temporalState.currentRisk.toFixed(1)}%)
          </span>
          <span className="text-[10px] font-mono text-slate-500 font-semibold">YOLO11 Telemetry</span>
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
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            
            <XAxis dataKey="time" type="number" domain={[0, maxDurationSec]} stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 10 }} />
            
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xl text-xs font-mono space-y-1 text-slate-900">
                      <p className="font-bold text-slate-900">Timecode: {data.time}s</p>
                      <p className="text-rose-600 font-bold">Risk Score R(t): {data.risk}%</p>
                      {data.event && <p className="text-amber-700 text-[11px] font-sans font-medium">{data.event}</p>}
                      <p className="text-slate-500 text-[10px]">Click data point to seek video here</p>
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
              x={roundedCurrentTime} 
              stroke="#10b981" 
              strokeWidth={2} 
              label={{ value: `▶ ${roundedCurrentTime}s`, fill: '#10b981', fontSize: 10, position: 'top' }} 
            />

            <Area type="monotone" dataKey="risk" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#riskGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1">
          💡 <strong className="text-slate-700">Bi-Directional Scrubbing:</strong> Click any peak node on graph to jump video to that frame.
        </span>
        <span className="font-mono text-slate-500 font-semibold">YOLO11 Sub-12ms Kinematic Telemetry</span>
      </div>
    </div>
  );
};

export default RiskTimelineChart;
