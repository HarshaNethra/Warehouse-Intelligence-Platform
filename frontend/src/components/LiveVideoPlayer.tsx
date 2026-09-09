import React, { useRef, useState, useEffect } from 'react';
import { RefreshCw, ShieldAlert, Activity } from 'lucide-react';

export interface LiveVideoPlayerProps {
  src: string;
  currentTimeToSeek?: number;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  channelId?: string;
  className?: string;
}

export const LiveVideoPlayer: React.FC<LiveVideoPlayerProps> = ({
  src,
  currentTimeToSeek,
  onTimeUpdate,
  onDurationChange,
  channelId = 'Loading Bay 1',
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Handle graph click-to-seek synchronization
  useEffect(() => {
    if (videoRef.current && currentTimeToSeek !== undefined && !isNaN(currentTimeToSeek)) {
      videoRef.current.currentTime = currentTimeToSeek;
      videoRef.current.play().catch(() => {});
    }
  }, [currentTimeToSeek]);

  const handleRetry = () => {
    setErrorState(null);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  return (
    <div className={`relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden rounded-xl border border-slate-800 shadow-2xl select-none ${className || 'aspect-video'}`}>
      {/* Loading / Buffering Skeleton Overlay */}
      {isLoading && !errorState && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3 text-slate-100">
          <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-slate-300 uppercase tracking-wider font-semibold">
            Loading YOLO11 Stream [{channelId}]...
          </span>
        </div>
      )}

      {/* Error Fallback State */}
      {errorState && (
        <div className="absolute inset-0 bg-slate-950 z-20 flex flex-col items-center justify-center p-6 text-center text-slate-100 space-y-2">
          <ShieldAlert className="w-10 h-10 text-red-500 mb-1" />
          <span className="text-red-400 font-bold text-sm">Stream Transmission Error</span>
          <span className="text-xs font-mono text-slate-400 max-w-md">{errorState}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 font-mono font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      )}

      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        controls
        autoPlay
        muted
        loop
        playsInline
        onLoadedData={() => setIsLoading(false)}
        onLoadedMetadata={(e) => {
          setIsLoading(false);
          if (onDurationChange && e.currentTarget.duration) {
            onDurationChange(e.currentTarget.duration);
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => onTimeUpdate && onTimeUpdate(e.currentTarget.currentTime)}
        onError={() => {
          setIsLoading(false);
          setErrorState('Failed to load video stream source or file unsupported.');
        }}
      />

      {/* Live HUD Overlay Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-mono text-slate-200 shadow-lg pointer-events-none">
        <span className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
        <span className="font-bold text-white">{channelId}</span>
        <span className="text-slate-600">•</span>
        <span className="text-primary font-semibold flex items-center gap-1">
          <Activity className="w-3 h-3 text-primary animate-pulse" />
          YOLO11 Active
        </span>
      </div>
    </div>
  );
};

export default LiveVideoPlayer;
