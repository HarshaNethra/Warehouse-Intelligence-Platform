import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Maximize, Pause, RotateCcw, Activity, FastForward } from 'lucide-react';

export interface VideoPlayerProps {
  videoId?: string;
  timestamp?: number;
  duration?: number;
  objectId?: number;
  behaviour?: string;
  riskScore?: number;
  riskLevel?: string;
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoId, 
  timestamp: initialTimestamp,
  duration,
  objectId,
  behaviour,
  riskScore,
  riskLevel: _riskLevel,
}) => {
  // Enforce a strictly positive, valid duration that comfortably encompasses the incident timestamp
  const safeDuration = (typeof duration === 'number' && !isNaN(duration) && duration > 0)
    ? Math.max(duration, initialTimestamp !== undefined ? Math.ceil(initialTimestamp + 10) : 0)
    : (initialTimestamp !== undefined && initialTimestamp > 45 ? Math.ceil(initialTimestamp + 20) : 60);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => {
    if (initialTimestamp !== undefined && !isNaN(initialTimestamp)) {
      return Math.max(0, Math.min(safeDuration, initialTimestamp));
    }
    return 0;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastInitialTimestampRef = useRef<number | undefined>(initialTimestamp);

  // If parent updates initial timestamp (e.g. seeking to an incident), jump to it safely
  useEffect(() => {
    if (
      initialTimestamp !== undefined && 
      !isNaN(initialTimestamp) && 
      initialTimestamp !== lastInitialTimestampRef.current
    ) {
      lastInitialTimestampRef.current = initialTimestamp;
      setCurrentTime(Math.max(0, Math.min(safeDuration, initialTimestamp)));
    }
  }, [initialTimestamp, safeDuration]);

  // Playback timer simulation taking speed into account (fixed floating point precision)
  useEffect(() => {
    if (!isPlaying || isDragging) return;

    const step = 0.1 * playbackSpeed;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + step;
        if (next >= safeDuration) {
          setIsPlaying(false);
          return safeDuration;
        }
        return Math.round(next * 100) / 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, isDragging, safeDuration, playbackSpeed]);

  const updateTimeFromClientX = useCallback((clientX: number) => {
    if (!timelineRef.current || safeDuration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = Number((ratio * safeDuration).toFixed(1));
    setCurrentTime(newTime);
  }, [safeDuration]);

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateTimeFromClientX(e.clientX);
  };

  const handleTimelineTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches[0]) return;
    setIsDragging(true);
    updateTimeFromClientX(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateTimeFromClientX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        updateTimeFromClientX(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, updateTimeFromClientX]);

  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleReset = useCallback(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const cyclePlaybackSpeed = () => {
    setPlaybackSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not hijack standard browser shortcuts like Ctrl+R, Ctrl+F, Cmd+R, Cmd+F, Alt keys
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Ignore when focusing input or textarea elements
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((prev) => Math.max(0, Number((prev - 5).toFixed(1))));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((prev) => Math.min(safeDuration, Number((prev + 5).toFixed(1))));
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFullscreenToggle();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (initialTimestamp !== undefined) {
          setCurrentTime(initialTimestamp);
        } else {
          handleReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeDuration, initialTimestamp, handleFullscreenToggle, handleReset]);

  // Format mm:ss.s safely
  const formatTime = (timeInSeconds: number) => {
    const validSeconds = isNaN(timeInSeconds) || timeInSeconds < 0 ? 0 : timeInSeconds;
    const mins = Math.floor(validSeconds / 60);
    const secs = (validSeconds % 60).toFixed(1);
    return `${String(mins).padStart(2, '0')}:${secs.padStart(4, '0')}`;
  };

  // Simulated overlay dynamics around the current timestamp
  const showActiveIncidentBox = initialTimestamp !== undefined && Math.abs(currentTime - initialTimestamp) < 3.0;

  // Percentage calculations strictly bounded [0, 100]
  const progressPercent = safeDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))
    : 0;

  const markerPercent = (initialTimestamp !== undefined && safeDuration > 0)
    ? Math.min(100, Math.max(0, (initialTimestamp / safeDuration) * 100))
    : null;

  // Dynamic HUD telemetry text
  const anomalyObjText = objectId !== undefined ? `OBJ_${objectId}` : 'OBJ_ANOMALY';
  const anomalyScoreText = riskScore !== undefined ? `[${riskScore}%]` : '[85%]';
  const anomalyTitle = behaviour 
    ? `${anomalyObjText} • ${behaviour} ${anomalyScoreText}` 
    : `${anomalyObjText} ${anomalyScoreText}`;

  return (
    <div ref={containerRef} className="glass-panel overflow-hidden flex flex-col group relative bg-black fullscreen:h-screen fullscreen:w-screen fullscreen:justify-between">
      {/* Video Viewport */}
      <div 
        className="relative aspect-video fullscreen:flex-1 fullscreen:aspect-auto bg-gradient-to-b from-slate-950 via-slate-900 to-black flex items-center justify-center select-none overflow-hidden cursor-pointer"
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {/* Subtle grid background simulating camera sensor */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none z-10" />
        
        {/* Camera Info HUD Top Left */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 text-xs font-mono bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 text-white">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold text-slate-200">FEED: {videoId || 'CAM-01-LIVE'}</span>
          <span className="text-slate-400">| 1080p 30fps</span>
        </div>

        {/* Inference HUD Top Right */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 text-xs font-mono bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 text-emerald-400">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>BYTE-TRACK ID: ACTIVE</span>
        </div>

        {/* Dynamic Detection Bounding Box */}
        {showActiveIncidentBox && (
          <div 
            className="absolute z-20 border-2 border-rose-500 bg-rose-500/10 rounded transition-all duration-150 animate-pulse"
            style={{
              top: '40%',
              left: `${Math.min(75, Math.max(10, 30 + (currentTime - (initialTimestamp || 0)) * 5))}%`,
              width: '140px',
              height: '110px'
            }}
          >
            <div className="bg-rose-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-t -mt-5 inline-block truncate max-w-[160px]">
              {anomalyTitle}
            </div>
            <div className="absolute bottom-1 right-1 text-[9px] font-mono text-rose-300 bg-black/60 px-1 rounded">
              v: 3.8 m/s
            </div>
          </div>
        )}

        {/* Static worker bounding box indicator */}
        <div className="absolute top-1/4 left-1/5 w-24 h-44 border border-blue-500/60 bg-blue-500/5 rounded z-20 pointer-events-none hidden sm:block">
          <span className="bg-blue-600 text-white text-[9px] font-mono px-1 rounded-t -mt-4 inline-block">
            Person #12
          </span>
        </div>

        {/* Center Display / State */}
        <div className="text-center z-20 px-4">
          <p className="text-slate-200 font-medium text-sm sm:text-base tracking-wide mb-1">
            Warehouse Video Feed Telemetry
          </p>
          <p className="text-xs text-slate-400 font-mono">
            Timecode: {formatTime(currentTime)} / {formatTime(safeDuration)}
          </p>
          {initialTimestamp !== undefined && (
            <p className="text-primary text-xs mt-2 font-mono bg-primary/20 px-2 py-0.5 rounded border border-primary/30 inline-block">
              Incident Marker at {initialTimestamp.toFixed(1)}s
            </p>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-3 bg-slate-900 text-slate-300 flex items-center justify-between border-t border-slate-800 select-none">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="hover:text-white hover:bg-slate-800 text-primary p-2 rounded-lg btn-interactive transition-colors"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="hover:text-white hover:bg-slate-800 p-1.5 rounded-lg btn-interactive text-slate-400 transition-colors"
            title="Reset to beginning (R)"
            aria-label="Reset video"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="text-xs font-mono text-slate-400 pl-1 hidden sm:block">
            <span className="text-white font-semibold">{formatTime(currentTime)}</span> / {formatTime(safeDuration)}
          </div>
        </div>
        
        {/* Timeline Scrubber */}
        <div 
          ref={timelineRef}
          role="slider"
          tabIndex={0}
          aria-label="Video scrubber"
          aria-valuemin={0}
          aria-valuemax={safeDuration}
          aria-valuenow={currentTime}
          onMouseDown={handleTimelineMouseDown}
          onTouchStart={handleTimelineTouchStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              setCurrentTime((prev) => Math.max(0, Number((prev - 2).toFixed(1))));
            } else if (e.key === 'ArrowRight') {
              setCurrentTime((prev) => Math.min(safeDuration, Number((prev + 2).toFixed(1))));
            }
          }}
          className="flex-1 mx-3 sm:mx-4 h-2.5 bg-slate-800 hover:h-3 rounded-full overflow-hidden relative cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {/* Incident Marker indicator */}
          {markerPercent !== null && (
            <div
              className="absolute top-0 bottom-0 w-2 bg-rose-500 hover:bg-rose-400 hover:w-3 z-10 transition-all cursor-pointer rounded-full shadow-xs"
              style={{ left: `${markerPercent}%` }}
              onClick={(e) => {
                e.stopPropagation();
                if (initialTimestamp !== undefined) {
                  setCurrentTime(initialTimestamp);
                }
              }}
              title={`Click to jump to incident marker (${initialTimestamp}s)`}
            />
          )}

          {/* Progress bar */}
          <div 
            className="absolute top-0 left-0 h-full bg-primary transition-all duration-75" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Playback speed toggle */}
          <button
            type="button"
            onClick={cyclePlaybackSpeed}
            className="px-2 py-1 text-xs font-mono font-bold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
            title="Cycle playback speed"
            aria-label={`Playback speed ${playbackSpeed}x`}
          >
            <FastForward className="w-3 h-3 text-primary" />
            <span>{playbackSpeed}x</span>
          </button>

          <button 
            type="button"
            onClick={handleFullscreenToggle}
            className="hover:text-white hover:bg-slate-800 p-1.5 rounded-lg btn-interactive text-slate-400 transition-colors"
            title="Toggle Fullscreen (F)"
            aria-label="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
