import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';
import type { FrameTelemetryPoint } from '../types/telemetry';

export interface RiskTimelineProps {
  timelineData: FrameTelemetryPoint[];
  currentTime?: number;
  videoDuration?: number;
  compositeRiskScore?: number;
  peakRisk?: number;
  onSeek?: (seconds: number) => void;
  onDataPointClick?: (seconds: number) => void;
  className?: string;
}

export const RiskTimeline: React.FC<RiskTimelineProps> = ({
  timelineData,
  currentTime = 0,
  videoDuration = 60,
  compositeRiskScore = 85.0,
  peakRisk = 94.6,
  onSeek,
  onDataPointClick,
  className,
}) => {
  const roundedCurrentTime = Math.min(Math.round(currentTime), Math.floor(videoDuration));
  const maxDurationSec = Math.max(5, Math.ceil(videoDuration));

  // Truncate telemetry points to match actual video duration
  const activeTimeline = timelineData.filter((p) => p.time < maxDurationSec);

  const chartData = activeTimeline.map((point, index) => {
    const prevRisk = activeTimeline[index - 1]?.frameRisk || 0;
    const nextRisk = activeTimeline[index + 1]?.frameRisk || 0;
    // NMS local maxima check to prevent text collisions
    const isLocalMaxima = point.frameRisk >= 75 && point.frameRisk > prevRisk && point.frameRisk >= nextRisk;

    return {
      timestamp: point.time,
      timeLabel: `${point.time}s`,
      riskScore: point.frameRisk,
      event: point.event || 'Nominal Handling Stream',
      isPeakMaxima: isLocalMaxima || point.isPeak
    };
  });

  const peakPoint = activeTimeline.reduce(
    (max, p) => (p.frameRisk > max.frameRisk ? p : max),
    activeTimeline[0] || { time: 0, frameRisk: peakRisk }
  );

  const activePoint = activeTimeline.find((p) => p.time === roundedCurrentTime);

  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const rawSeconds = state.activePayload[0].payload.timestamp;
      const clampedSeconds = Math.min(rawSeconds, Math.floor(videoDuration));
      if (onSeek) {
        onSeek(clampedSeconds);
      } else if (onDataPointClick) {
        onDataPointClick(clampedSeconds);
      }
    }
  };

  const renderPeakDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    if (payload.isPeakMaxima) {
      return (
        <g key={`dot-${payload.timestamp}`}>
          <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#ffffff" strokeWidth={2} className="animate-pulse" />
          <text x={cx} y={cy - 10} textAnchor="middle" fill="#f87171" fontSize={10} fontWeight="bold" fontFamily="monospace">
            {payload.timestamp}s: {payload.riskScore}%
          </text>
        </g>
      );
    }
    return null;
  };

  return (
    <div className={`glass-panel p-5 bg-white border border-slate-200 text-slate-900 rounded-xl shadow-2xs space-y-3 ${className || ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Kinematic Risk Timeline & Scrubber
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Duration: <span className="font-mono text-slate-800 font-bold">{maxDurationSec}s</span> • Peak Anomaly: <strong className="text-red-600">{String(peakPoint.time).padStart(2, '0')}s ({peakPoint.frameRisk || peakRisk}%)</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
            <TrendingUp className="w-3.5 h-3.5 text-red-600" />
            <span className="text-slate-500">Peak Risk:</span>
            <span className="font-mono font-bold text-red-600">{peakRisk.toFixed(1)}%</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
            <span className="text-emerald-700">Composite Index:</span>
            <span className="font-mono font-bold text-emerald-700">{compositeRiskScore.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Active Event Banner */}
      {activePoint?.event && activePoint.event !== 'Nominal Handling Stream' ? (
        <div className="bg-red-50 border border-red-200 p-2.5 rounded-xl text-xs flex items-center justify-between text-red-900 animate-pulse">
          <span className="font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            Anomaly Detected at {activePoint.time}s: {activePoint.event}
          </span>
          <span className="font-mono text-[10px] bg-red-100 px-2 py-0.5 rounded border border-red-300 font-bold text-red-800">
            R(t): {activePoint.frameRisk}%
          </span>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs flex items-center justify-between text-slate-700">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Frame {roundedCurrentTime}s: Nominal Handling Stream (Risk R(t): {activePoint?.frameRisk || 15}%)
          </span>
          <span className="text-[10px] font-mono text-slate-500 font-semibold">YOLO11 Telemetry</span>
        </div>
      )}

      {/* Recharts Area Chart */}
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 18, right: 10, left: -20, bottom: 0 }}
            onClick={handleChartClick}
          >
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.7} />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            
            <XAxis dataKey="timestamp" unit="s" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 10 }} />
            
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xl text-xs font-mono space-y-1 text-slate-900">
                      <p className="font-bold text-slate-900">Timecode: {data.timestamp}s</p>
                      <p className="text-red-600 font-bold">Risk Score R(t): {data.riskScore}%</p>
                      {data.event && <p className="text-amber-700 text-[11px] font-sans font-medium">{data.event}</p>}
                      <p className="text-slate-500 text-[10px]">Click point to seek video & auto-play</p>
                    </div>
                  );
                }
                return null;
              }}
            />

            <ReferenceLine y={35} stroke="#f59e0b" strokeDasharray="3 3" />
            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
            
            {/* Synchronized Real-Time Playhead Cursor */}
            <ReferenceLine 
              x={roundedCurrentTime} 
              stroke="#ef4444" 
              strokeWidth={2} 
              label={{ value: `▶ ${roundedCurrentTime}s`, fill: '#ef4444', fontSize: 10, position: 'top' }} 
            />

            <Area 
              type="monotone" 
              dataKey="riskScore" 
              stroke="#ef4444" 
              fill="url(#riskGradient)" 
              strokeWidth={2} 
              dot={renderPeakDot}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
        <span>💡 Click any highlighted red peak dot on the graph to jump the video directly to that incident frame.</span>
        <span className="font-mono text-slate-500 font-semibold">YOLO11 Kinematic Engine</span>
      </div>
    </div>
  );
};

export default RiskTimeline;
