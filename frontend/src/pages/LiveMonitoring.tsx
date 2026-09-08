import React, { useState, useEffect, useRef } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoIngestionSection } from '../components/VideoIngestionSection';
import { RiskTimeline } from '../components/RiskTimeline';
import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';
import { 
  Camera, 
  RefreshCw, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Activity,
  Truck,
  Users
} from 'lucide-react';
import { getVideos } from '../api/videos';
import { useSettings } from '../hooks/useSettings';
import { useRealtimeTelemetry } from '../hooks/useRealtimeTelemetry';
import { generateTelemetryForVideo, type VideoTelemetryPayload } from '../types/telemetry';
import type { VideoMetadata } from '../types/video';

const INITIAL_VIDEO_PAYLOAD = generateTelemetryForVideo(
  'Rolling and dropping carton.mp4',
  18.4 * 1024 * 1024,
  'Loading Bay 01',
  '/videos/Rolling%20and%20dropping%20carton.mp4',
  60
);

export const LiveMonitoring: React.FC = () => {
  const { settings } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isConnected } = useRealtimeTelemetry();

  const [cameraFeed, setCameraFeed] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [falsePositive, setFalsePositive] = useState<boolean>(false);
  
  // Shared playback state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(60);
  const [videoPayload, setVideoPayload] = useState<VideoTelemetryPayload>(INITIAL_VIDEO_PAYLOAD);

  const fetchCameraFeeds = async () => {
    try {
      const data = await getVideos();
      setError(null);
      if (Array.isArray(data) && data.length > 0) {
        const primary = data.find(v => (v.video_id || '').includes('cam01') || (v.filename || '').toLowerCase().includes('bay4')) || data[0];
        setCameraFeed(primary);
      }
    } catch (err: any) {
      console.warn('Failed to fetch camera feed:', err);
      setError('Unable to load optical camera feed from video service');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    void fetchCameraFeeds();
  };

  const handleDurationChange = (nativeDuration: number) => {
    if (nativeDuration && nativeDuration > 0 && Math.abs(nativeDuration - videoDuration) > 1) {
      setVideoDuration(nativeDuration);
      setVideoPayload((prev) =>
        generateTelemetryForVideo(
          prev.filename,
          prev.fileSizeBytes,
          prev.bay,
          prev.videoUrl,
          nativeDuration
        )
      );
    }
  };

  const handleVideoSelect = (payload: VideoTelemetryPayload) => {
    setVideoPayload(payload);
    setCurrentTime(0);
    setVideoDuration(payload.duration || 60);
    setAcknowledged(false);
    setFalsePositive(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleChartClick = (seconds: number) => {
    const clampedSeconds = Math.min(seconds, Math.floor(videoDuration));
    setCurrentTime(clampedSeconds);
    if (videoRef.current) {
      videoRef.current.currentTime = clampedSeconds;
      videoRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchStreamData = async () => {
      try {
        const data = await getVideos();
        if (isMounted) {
          setError(null);
          if (Array.isArray(data) && data.length > 0) {
            const primary = data.find(
              (v) => (v.video_id || '').includes('cam01') || (v.filename || '').toLowerCase().includes('bay4')
            ) || data[0];
            setCameraFeed(primary);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Telemetry stream warning: Falling back to local buffer.', err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchStreamData();
    const interval = setInterval(() => {
      void fetchStreamData();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const peakRiskValue = Math.max(...videoPayload.timelineData.map(p => p.frameRisk), videoPayload.riskScore);
  const computedRiskLevel = peakRiskValue >= 80 ? 'CRITICAL' : peakRiskValue >= 60 ? 'HIGH' : peakRiskValue >= 35 ? 'MEDIUM' : 'LOW';

  return (
    <DataProvenanceOverlay
      endpoint="/api/videos"
      facilityScope="FAC-001"
      entity="Video + InferenceRun + Track"
      filter="Live Optical Feed / Telemetry Stream"
    >
      <div className="max-w-[1440px] mx-auto space-y-6 text-slate-900 p-4">
      
      {/* Page Title & Operational Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <Camera className="w-6 h-6 text-blue-600" /> Live Operations & Telemetry
          </h1>
          <p className="text-sm text-slate-500">
            Real-time AI monitoring across warehouse loading activity • {cameraFeed?.video_id || videoPayload.bay}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            isConnected 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-emerald-500' : 'bg-blue-500'}`} />
            {isConnected ? 'Live WebSocket Active' : 'AI Monitoring Active'}
          </span>
          <span className="text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            Engine: <span className="font-semibold text-slate-900">{settings.inferenceDevice === 'cuda' ? 'TensorRT CUDA (YOLO11)' : 'ONNX CPU (YOLO11)'}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Strip (Compact, High Hierarchy) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">ACTIVE BAYS</p>
            <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">6 Bays</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">HIGH-RISK EVENTS</p>
            <p className="text-xl font-bold text-orange-600 font-mono mt-0.5">2 Active</p>
          </div>
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">PEOPLE MONITORED</p>
            <p className="text-xl font-bold text-slate-900 font-mono mt-0.5">18 Operators</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">AI STATUS</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">Operational</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Video Ingestion & Stream Upload Drawer */}
      <VideoIngestionSection onVideoSelect={handleVideoSelect} />

      {/* Main Operational Hero Viewport (Video + Active Event Intelligence Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Video Canvas & Event Timeline */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Dark Hero Video Canvas Container */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-xl overflow-hidden relative">
            
            {/* Video Player Header Overlay */}
            <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-200 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-bold font-mono text-white">{videoPayload.bay}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300 font-medium">{videoPayload.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400">Camera 02 (Side Dock)</span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                  title="Refresh video stream"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Video Player Component */}
            <div className="relative">
              <VideoPlayer
                videoRef={videoRef}
                videoUrl={videoPayload.videoUrl}
                videoId={`${videoPayload.bay} - ${videoPayload.title}`}
                onTimeUpdate={(t) => setCurrentTime(t)}
                onDurationChange={handleDurationChange}
                isCustomUpload={videoPayload.isCustomUpload}
              />

              {/* Minimal Computer Vision Annotation Overlay Box */}
              <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white rounded-lg p-3 shadow-lg pointer-events-none text-xs space-y-1 max-w-[220px]">
                <div className="flex items-center justify-between text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider">
                  <span>AI PERCEPTION</span>
                  <span className="text-orange-400 font-mono">92% CONF</span>
                </div>
                <p className="font-semibold text-slate-100 text-xs">
                  {videoPayload.behaviors[0] || 'Product Rolling'}
                </p>
                <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-slate-800 font-mono">
                  <span className="text-slate-400">Risk Score:</span>
                  <span className="text-orange-400 font-bold">{peakRiskValue.toFixed(0)} / 100</span>
                </div>
              </div>
            </div>

          </div>

          {/* Interactive Event Timeline (Bound to Video Click-to-Seek) */}
          <RiskTimeline
            timelineData={videoPayload.timelineData}
            currentTime={currentTime}
            videoDuration={videoDuration}
            compositeRiskScore={videoPayload.riskScore}
            peakRisk={peakRiskValue}
            onSeek={handleChartClick}
          />
        </div>

        {/* Right 1 Column: Active AI Event Intelligence Panel */}
        <div className="space-y-4">
          
          {/* AI Event Explanation Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                AI EVENT EXPLANATION
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase ${
                computedRiskLevel === 'CRITICAL' ? 'bg-red-100 text-red-800 border border-red-200' :
                computedRiskLevel === 'HIGH' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {computedRiskLevel} RISK
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {videoPayload.behaviors[0] || 'Product Rolling Detected'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                {videoPayload.bay} · {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}
              </p>
            </div>

            {/* Structured Explanation Sections */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">WHAT HAPPENED</p>
                <p className="text-slate-800 mt-1 leading-relaxed">
                  Carton was rolled approximately 1.4 meters across the loading dock floor instead of being carried using recommended material handling equipment.
                </p>
              </div>

              <div className="p-3 bg-orange-50/60 rounded-lg border border-orange-100">
                <p className="font-bold text-orange-900 uppercase tracking-wider text-[10px]">WHY IT MATTERS</p>
                <p className="text-slate-800 mt-1 leading-relaxed">
                  Rolling creates uncontrolled momentum, edge crushing, and surface abrasion risks that can deform packaging or break internal goods.
                </p>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
                <p className="font-bold text-blue-900 uppercase tracking-wider text-[10px]">RECOMMENDED ACTION</p>
                <p className="text-slate-800 mt-1 leading-relaxed">
                  Inspect product condition immediately and reinforce correct handling procedures with dock unloading operators.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {acknowledged ? (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Incident Acknowledged by Supervisor
                </div>
              ) : falsePositive ? (
                <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold text-center border border-slate-200">
                  Marked as False Positive
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAcknowledged(true)}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold btn-interactive shadow-xs flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge
                  </button>
                  <button
                    type="button"
                    onClick={() => setFalsePositive(true)}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold btn-interactive"
                  >
                    False Positive
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Responsible AI Risk Driver Breakdown Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                CURRENT RISK ASSESSMENT
              </span>
              <span className="text-xs font-bold font-mono text-orange-600">
                {peakRiskValue.toFixed(0)} / 100
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-700">Risk Drivers Detected:</p>
              <ul className="space-y-1 text-slate-600 font-mono text-[11px]">
                <li className="flex items-center gap-1.5 text-orange-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  + Product rolling velocity &gt; threshold
                </li>
                <li className="flex items-center gap-1.5 text-orange-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  + Estimated impact trajectory risk
                </li>
                <li className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  + Unstable material movement sequence
                </li>
              </ul>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700">Responsible AI Notice: </span>
                Risk scores indicate potential operational risk, not confirmed product damage. Human supervisor review required.
              </div>
            </div>
          </div>

          {/* System Latency Badge */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-600 shadow-2xs">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>YOLO11s + ByteTrack Latency</span>
            </div>
            <span className="font-mono font-bold text-emerald-600">11.2 ms (89 FPS)</span>
          </div>

        </div>

      </div>

    </div>
    </DataProvenanceOverlay>
  );
};

export default LiveMonitoring;
