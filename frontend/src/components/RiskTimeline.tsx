import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';
import { getRiskAtTime, type FrameTelemetryPoint } from '../types/telemetry';

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
  onSeek,
  onDataPointClick,
  className,
}) => {
  const temporalState = getRiskAtTime(timelineData, currentTime);
  const maxDurationSec = Math.max(5, Math.ceil(videoDuration || temporalState.videoDuration || 60));

  const activeTimeline: FrameTelemetryPoint[] = timelineData && timelineData.length > 0
    ? timelineData.filter((p) => p.time <= maxDurationSec)
    : Array.from({ length: maxDurationSec + 1 }, (_, i) => ({
        time: i,
        frameRisk: i === Math.floor(maxDurationSec * 0.4) ? 75.0 : 15.0,
        event: i === Math.floor(maxDurationSec * 0.4) ? 'Motion Anomaly Flagged' : undefined,
        isPeak: i === Math.floor(maxDurationSec * 0.4)
      }));

  const chartData = activeTimeline.map((point, index) => {
    const prevRisk = activeTimeline[index - 1]?.frameRisk || 0;
    const nextRisk = activeTimeline[index + 1]?.frameRisk || 0;
    const isLocalMaxima = point.frameRisk >= 60 && point.frameRisk > prevRisk && point.frameRisk >= nextRisk;

    return {
      timestamp: point.time,
      timeLabel: `${point.time}s`,
      riskScore: point.frameRisk,
      event: point.event || 'Nominal Handling Stream',
      isPeakMaxima: isLocalMaxima || point.isPeak,
    };
  });

  const displayPeakPoint = temporalState.peakPoint;
  const roundedCurrentTime = Math.round(temporalState.currentTime);

  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const rawSeconds = state.activePayload[0].payload.timestamp;
      const clampedSeconds = Math.min(Math.max(0, rawSeconds), Math.floor(maxDurationSec));
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
          {/* Subtle Outer Glow Ring */}
          <circle cx={cx} cy={cy} r={8} fill="#ef4444" fillOpacity={0.25} />
          {/* Crisp Inner High-Risk Node */}
          <circle cx={cx} cy={cy} r={4.5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
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
            <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
            Kinematic Risk Timeline & Scrubber
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Duration: <span className="font-mono text-slate-800 font-bold">{maxDurationSec}s</span> • Peak Anomaly: <strong className="text-red-600">{String(displayPeakPoint.time).padStart(2, '0')}s ({displayPeakPoint.frameRisk.toFixed(1)}%)</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 px-2.5 sm:px-3 py-1 rounded-lg border border-slate-200">
            <TrendingUp className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="text-slate-500">Peak Risk:</span>
            <span className="font-mono font-bold text-red-600">{displayPeakPoint.frameRisk.toFixed(1)}%</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-emerald-50 px-2.5 sm:px-3 py-1 rounded-lg border border-emerald-200">
            <span className="text-emerald-700">Composite:</span>
            <span className="font-mono font-bold text-emerald-700">{compositeRiskScore.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Active Event Banner derived directly from Video currentTime */}
      {temporalState.currentEvent ? (
        <div className="bg-red-50 border border-red-200 p-2.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-red-900 animate-pulse">
          <span className="font-semibold flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-red-600 shrink-0"></span>
            <span className="truncate">Anomaly at {roundedCurrentTime}s: {temporalState.currentEvent}</span>
          </span>
          <span className="font-mono text-[10px] bg-red-100 px-2 py-0.5 rounded border border-red-300 font-bold text-red-800 self-start sm:self-auto shrink-0">
            Risk R(t): {temporalState.currentRisk.toFixed(1)}%
          </span>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-700">
          <span className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="truncate">Frame {roundedCurrentTime}s: Nominal Stream (Risk: {temporalState.currentRisk.toFixed(1)}%)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500 font-semibold shrink-0">YOLO11 Telemetry</span>
        </div>
      )}

      {/* Recharts Area Chart */}
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 22, right: 20, left: -20, bottom: 0 }}
            onClick={handleChartClick}
          >
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.7} />
                <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            
            <XAxis dataKey="timestamp" type="number" domain={[0, maxDurationSec]} unit="s" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 10 }} />
            
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xl text-xs font-mono space-y-1 text-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-slate-900">Time: {data.timestamp}s</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${data.riskScore >= 80 ? 'bg-red-100 text-red-700' : data.riskScore >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {data.riskScore}%
                        </span>
                      </div>
                      {data.event && <p className="text-slate-700 text-[11px] font-sans font-medium">{data.event}</p>}
                      <p className="text-blue-600 text-[10px] font-sans">Click to jump video to {data.timestamp}s</p>
                    </div>
                  );
                }
                return null;
              }}
            />

            <ReferenceLine y={35} stroke="#f59e0b" strokeDasharray="3 3" />
            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" />
            
            {/* Synchronized Real-Time Playhead Cursor (Blue Seek Line) */}
            <ReferenceLine 
              x={roundedCurrentTime} 
              stroke="#2563eb" 
              strokeWidth={2}
              strokeDasharray="4 2" 
              label={{ value: `▶ ${roundedCurrentTime}s`, fill: '#2563eb', fontSize: 10, fontWeight: 'bold', position: 'top' }} 
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
