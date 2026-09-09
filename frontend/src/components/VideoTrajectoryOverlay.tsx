import React, { useMemo } from 'react';
import type { FrameTelemetryPoint } from '../types/telemetry';

export interface VideoTrajectoryOverlayProps {
  currentTime: number;
  duration?: number;
  timelineData?: FrameTelemetryPoint[];
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
  showBoxes?: boolean;
  showTrails?: boolean;
  activeRiskScore?: number;
  activeBehavior?: string;
}

export const VideoTrajectoryOverlay: React.FC<VideoTrajectoryOverlayProps> = ({
  currentTime,
  timelineData = [],
  renderedWidth,
  renderedHeight,
  offsetX,
  offsetY,
  showBoxes = true,
  showTrails = true,
  activeRiskScore = 15.0,
  activeBehavior,
}) => {
  if (!showBoxes && !showTrails) return null;

  // Find active and recent trajectory points for the trail
  const currentPoint = useMemo(() => {
    const rounded = Math.floor(currentTime);
    const match = timelineData.find((p) => p.time === rounded);
    if (match) return match;

    // Fallback dynamic synthesis based on timecode
    const normX = Math.min(65, Math.max(15, 30 + (rounded % 7) * 4));
    const normY = Math.min(60, Math.max(20, 35 + Math.sin(currentTime * 0.7) * 8));
    return {
      time: rounded,
      frameRisk: activeRiskScore,
      targetClass: activeRiskScore >= 70 ? (activeBehavior || 'Carton (Hazard)') : 'Carton #42',
      objectId: 42,
      bbox: [normX, normY, 22, 26] as [number, number, number, number],
      accelerationY: activeRiskScore >= 70 ? 12.4 : 1.8,
    };
  }, [currentTime, timelineData, activeRiskScore, activeBehavior]);

  const trailPoints = useMemo(() => {
    if (!showTrails) return [];
    const rounded = Math.floor(currentTime);
    const start = Math.max(0, rounded - 4);
    const pts: { x: number; y: number; alpha: number; risk: number }[] = [];

    for (let t = start; t <= rounded; t++) {
      const match = timelineData.find((p) => p.time === t);
      const bx = match?.bbox?.[0] ?? Math.min(65, Math.max(15, 30 + (t % 7) * 4));
      const by = match?.bbox?.[1] ?? Math.min(60, Math.max(20, 35 + Math.sin(t * 0.7) * 8));
      const bw = match?.bbox?.[2] ?? 22;
      const bh = match?.bbox?.[3] ?? 26;

      const centerX = offsetX + ((bx + bw / 2) / 100) * renderedWidth;
      const centerY = offsetY + ((by + bh / 2) / 100) * renderedHeight;
      const age = rounded - t;
      const alpha = Math.max(0.15, 1 - age * 0.22);
      const risk = match?.frameRisk ?? activeRiskScore;

      pts.push({ x: centerX, y: centerY, alpha, risk });
    }
    return pts;
  }, [currentTime, timelineData, offsetX, offsetY, renderedWidth, renderedHeight, showTrails, activeRiskScore]);

  const bbox = currentPoint.bbox || [30, 35, 22, 26];
  const boxLeftPx = offsetX + (bbox[0] / 100) * renderedWidth;
  const boxTopPx = offsetY + (bbox[1] / 100) * renderedHeight;
  const boxWidthPx = (bbox[2] / 100) * renderedWidth;
  const boxHeightPx = (bbox[3] / 100) * renderedHeight;

  const risk = currentPoint.frameRisk || activeRiskScore;
  const isCritical = risk >= 75;
  const isHigh = risk >= 60 && risk < 75;
  const isMedium = risk >= 35 && risk < 60;

  const strokeColor = isCritical ? '#ef4444' : isHigh ? '#f97316' : isMedium ? '#f59e0b' : '#10b981';
  const bgColor = isCritical ? 'rgba(239, 68, 68, 0.15)' : isHigh ? 'rgba(249, 115, 22, 0.12)' : isMedium ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      <svg className="w-full h-full">
        {/* Motion Trails Polyline */}
        {showTrails && trailPoints.length > 1 && (
          <g>
            {trailPoints.map((pt, i) => {
              if (i === 0) return null;
              const prev = trailPoints[i - 1];
              return (
                <line
                  key={`trail-${i}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={pt.x}
                  y2={pt.y}
                  stroke={strokeColor}
                  strokeWidth="3"
                  strokeDasharray="4 3"
                  strokeOpacity={pt.alpha}
                />
              );
            })}
            {trailPoints.map((pt, i) => (
              <circle
                key={`dot-${i}`}
                cx={pt.x}
                cy={pt.y}
                r={i === trailPoints.length - 1 ? 5 : 3}
                fill={strokeColor}
                fillOpacity={pt.alpha}
              />
            ))}
          </g>
        )}

        {/* Dynamic Bounding Box */}
        {showBoxes && (
          <g>
            <rect
              x={boxLeftPx}
              y={boxTopPx}
              width={boxWidthPx}
              height={boxHeightPx}
              fill={bgColor}
              stroke={strokeColor}
              strokeWidth="2"
              rx="4"
              className={isCritical ? 'animate-pulse' : ''}
            />

            {/* Corner crosshairs */}
            <line x1={boxLeftPx} y1={boxTopPx} x2={boxLeftPx + 10} y2={boxTopPx} stroke={strokeColor} strokeWidth="3" />
            <line x1={boxLeftPx} y1={boxTopPx} x2={boxLeftPx} y2={boxTopPx + 10} stroke={strokeColor} strokeWidth="3" />
            <line x1={boxLeftPx + boxWidthPx} y1={boxTopPx} x2={boxLeftPx + boxWidthPx - 10} y2={boxTopPx} stroke={strokeColor} strokeWidth="3" />
            <line x1={boxLeftPx + boxWidthPx} y1={boxTopPx} x2={boxLeftPx + boxWidthPx} y2={boxTopPx + 10} stroke={strokeColor} strokeWidth="3" />
            <line x1={boxLeftPx} y1={boxTopPx + boxHeightPx} x2={boxLeftPx + 10} y2={boxTopPx + boxHeightPx} stroke={strokeColor} strokeWidth="3" />
            <line x1={boxLeftPx} y1={boxTopPx + boxHeightPx} x2={boxLeftPx} y2={boxTopPx + boxHeightPx - 10} stroke={strokeColor} strokeWidth="3" />
            <line x1={boxLeftPx + boxWidthPx} y1={boxTopPx + boxHeightPx} x2={boxLeftPx + boxWidthPx - 10} y2={boxTopPx + boxHeightPx} stroke={strokeColor} strokeWidth="3" />
            <line x1={boxLeftPx + boxWidthPx} y1={boxTopPx + boxHeightPx} x2={boxLeftPx + boxWidthPx} y2={boxTopPx + boxHeightPx - 10} stroke={strokeColor} strokeWidth="3" />
          </g>
        )}
      </svg>

      {/* HTML Tag for Crisp High-Res Text Rendering */}
      {showBoxes && (
        <div
          style={{
            position: 'absolute',
            left: `${boxLeftPx}px`,
            top: `${Math.max(10, boxTopPx - 24)}px`,
          }}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase text-white shadow-md transition-all"
        >
          <span
            style={{ backgroundColor: strokeColor }}
            className="px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {currentPoint.targetClass || activeBehavior || 'Carton #42'}
            <span className="opacity-90 font-normal">[{risk.toFixed(1)}%]</span>
          </span>
          {currentPoint.accelerationY && currentPoint.accelerationY > 5.0 && (
            <span className="bg-red-950/90 text-red-300 border border-red-500/50 px-1 py-0.5 rounded text-[9px]">
              ay: {currentPoint.accelerationY.toFixed(1)} m/s²
            </span>
          )}
        </div>
      )}
    </div>
  );
};
