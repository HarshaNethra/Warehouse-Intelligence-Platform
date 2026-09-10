import React, { useState, useRef, useEffect } from 'react';
import { Film, Activity, Clock } from 'lucide-react';
import { formatTimecode } from '../utils/formatters';
import { VideoTrajectoryOverlay } from './VideoTrajectoryOverlay';
import { getRiskAtTime, type FrameTelemetryPoint } from '../types/telemetry';

export interface VideoPlayerProps {
  videoUrl?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  videoId?: string;
  onTimeUpdate?: (currentTimeSeconds: number) => void;
  onDurationChange?: (durationSeconds: number) => void;
  duration?: number;
  objectId?: number;
  riskLevel?: string;
  isCustomUpload?: boolean;
  currentTime?: number;
  timestamp?: number;
  behaviour?: string;
  riskScore?: number;
  timelineData?: FrameTelemetryPoint[];
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  videoRef: externalVideoRef,
  videoId = 'Loading Bay 1 - CAM-02',
  onTimeUpdate,
  onDurationChange,
  isCustomUpload = false,
  currentTime: externalCurrentTime,
  timestamp,
  behaviour,
  riskScore: explicitRiskScore,
  timelineData,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [internalTime, setInternalTime] = useState(0);

  // Layout & Aspect Ratio State for Precise Letterboxed Bounding Box Tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoElementRef = externalVideoRef || internalVideoRef;

  const [containerSize, setContainerSize] = useState({ width: 800, height: 450 });
  const [videoNaturalSize, setVideoNaturalSize] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  const displayTime = externalCurrentTime !== undefined ? externalCurrentTime : (timestamp !== undefined ? timestamp : internalTime);

  // Bidirectional sync: Seek HTML5 video when externalCurrentTime changes from graph click
  useEffect(() => {
    const videoEl = videoElementRef.current;
    if (videoEl && externalCurrentTime !== undefined && !isNaN(externalCurrentTime)) {
      if (Math.abs(videoEl.currentTime - externalCurrentTime) > 0.35) {
        videoEl.currentTime = externalCurrentTime;
      }
    }
  }, [externalCurrentTime, videoElementRef]);

  const handleNativeTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const current = e.currentTarget.currentTime;
    setInternalTime(current);
    if (onTimeUpdate) {
      onTimeUpdate(current);
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setHasError(false);
    setIsLoading(false);
    const videoEl = e.currentTarget;
    if (videoEl.videoWidth && videoEl.videoHeight) {
      setVideoNaturalSize({ width: videoEl.videoWidth, height: videoEl.videoHeight });
    }
    if (onDurationChange && videoEl.duration) {
      onDurationChange(videoEl.duration);
    }
  };

  // Aspect Ratio Calculation for Letterboxed Viewport Centering
  const containerAspect = containerSize.width / (containerSize.height || 1);
  const videoAspect = videoNaturalSize.width / (videoNaturalSize.height || 1);

  let renderedWidth = containerSize.width;
  let renderedHeight = containerSize.height;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect > videoAspect) {
    renderedHeight = containerSize.height;
    renderedWidth = renderedHeight * videoAspect;
    offsetX = (containerSize.width - renderedWidth) / 2;
    offsetY = 0;
  } else {
    renderedWidth = containerSize.width;
    renderedHeight = renderedWidth / videoAspect;
    offsetX = 0;
    offsetY = (containerSize.height - renderedHeight) / 2;
  }

  // Derive temporal risk state from single source of truth timeline
  const temporalState = getRiskAtTime(timelineData || [], displayTime);
  const activeRisk = timelineData && timelineData.length > 0
    ? temporalState.currentRisk
    : (explicitRiskScore !== undefined ? explicitRiskScore : 15.0);
  
  const isCritical = activeRisk >= 75.0 || temporalState.currentRiskLevel === 'CRITICAL';

  // Interactive AI Annotations Toggle Controls
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 shadow-2xl flex items-center justify-center select-none group"
    >
      {/* Loading & Buffering Skeleton Overlay */}
      {videoUrl && isLoading && !hasError && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3 text-slate-100">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-slate-300 uppercase tracking-wider font-semibold">
            Loading YOLO11 Stream [{videoId}]...
          </span>
        </div>
      )}

      {videoUrl && !hasError ? (
        <video
          ref={videoElementRef as React.RefObject<HTMLVideoElement>}
          src={videoUrl}
          className="w-full h-full object-contain"
          controls
          autoPlay
          muted
          loop
          playsInline
          onTimeUpdate={handleNativeTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => { setIsLoading(false); setIsPlaying(true); }}
          onPause={() => setIsPlaying(false)}
          onError={() => { setIsLoading(false); setHasError(true); }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-950 text-slate-400">
          <Film className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
          <p className="text-sm font-semibold text-slate-300">
            {hasError ? 'Optical Stream Offline' : 'No Video Feed Selected'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Select a pilot dataset clip or upload a video file to evaluate live inference.
          </p>
          {hasError && (
            <button
              type="button"
              onClick={() => { setHasError(false); setIsLoading(true); }}
              className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 font-mono font-semibold"
            >
              Retry Connection
            </button>
          )}
        </div>
      )}

      {/* Dynamic Letterbox-Aware Trajectory & Bounding Box Overlay */}
      {videoUrl && !hasError && (
        <VideoTrajectoryOverlay
          currentTime={displayTime}
          duration={videoNaturalSize.width ? displayTime : 60}
          timelineData={timelineData}
          renderedWidth={renderedWidth}
          renderedHeight={renderedHeight}
          offsetX={offsetX}
          offsetY={offsetY}
          showBoxes={showBoxes}
          showTrails={showTrails}
          activeRiskScore={activeRisk}
          activeBehavior={behaviour}
        />
      )}

      {/* Top-Left Glassmorphic Overlay HUD */}
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 pointer-events-none z-20 flex items-center gap-1.5 sm:gap-2.5 text-[10px] sm:text-xs font-mono bg-slate-900/90 backdrop-blur-md px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg border border-slate-800 shadow-lg text-white max-w-[85vw] truncate">
        <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
          {isCritical && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />}
          <span className={`relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} />
        </span>
        <span className="font-bold text-white tracking-wide truncate max-w-[100px] sm:max-w-none">{videoId}</span>
        <span className="text-[9px] sm:text-[11px] font-bold font-mono px-1.5 sm:px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1 shrink-0">
          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-400" />
          {formatTimecode(displayTime)}
        </span>
        <span className={`text-[9px] sm:text-[10px] font-bold font-mono px-1.5 sm:px-2 py-0.5 rounded shrink-0 ${
          isCritical ? 'bg-red-600 text-white' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
        }`}>
          {isCritical ? `CRITICAL ${activeRisk.toFixed(1)}%` : `NOMINAL ${activeRisk.toFixed(1)}%`}
        </span>
      </div>

      {/* Top-Right Active Badge & Annotation Controls */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 shadow-lg">
          <button
            type="button"
            onClick={() => setShowBoxes(!showBoxes)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
              showBoxes ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle YOLO Bounding Boxes"
          >
            Boxes: {showBoxes ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => setShowTrails(!showTrails)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
              showTrails ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Trajectory Motion Trails"
          >
            Trails: {showTrails ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-emerald-400 shadow-lg">
          <Activity className={`w-3.5 h-3.5 text-emerald-400 ${isPlaying ? 'animate-pulse' : ''}`} />
          <span className="text-slate-300">{isPlaying ? (isCustomUpload ? 'OPTICAL FILE STREAM' : 'LIVE SENSOR BUS') : 'STREAM PAUSED'}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
