import React from 'react';
import { RiskTimeline } from './RiskTimeline';
import type { FrameTelemetryPoint } from '../types/telemetry';

export interface FramePoint {
  frame: number;
  timestamp: number;
  risk_score: number;
  behaviors: string[];
}

export interface KinematicTimelineChartProps {
  telemetryData?: FramePoint[];
  timelineData?: FrameTelemetryPoint[];
  compositeRiskScore?: number;
  peakRisk?: number;
  className?: string;
  onFrameClick?: (timestamp: number) => void;
  onSeek?: (seconds: number) => void;
  currentTime?: number;
}

export const KinematicTimelineChart: React.FC<KinematicTimelineChartProps> = ({
  telemetryData,
  timelineData: explicitTimelineData,
  compositeRiskScore = 84.5,
  peakRisk = 94.6,
  className,
  onFrameClick,
  onSeek,
  currentTime = 0,
}) => {
  const points: FrameTelemetryPoint[] = explicitTimelineData || (telemetryData ? telemetryData.map(d => ({
    time: d.timestamp,
    frameRisk: d.risk_score,
    event: d.behaviors.join(', ')
  })) : Array.from({ length: 60 }, (_, i) => ({
    time: i,
    frameRisk: i === 30 ? 94.6 : 15 + Math.sin(i * 0.2) * 5,
    event: i === 30 ? 'Impact Spike > 9.8m/s²' : undefined
  })));

  return (
    <RiskTimeline
      timelineData={points}
      currentTime={currentTime}
      compositeRiskScore={compositeRiskScore}
      peakRisk={peakRisk}
      onSeek={onSeek || onFrameClick}
      className={className}
    />
  );
};

export default KinematicTimelineChart;
