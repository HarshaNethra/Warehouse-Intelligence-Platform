import React, { useState, useEffect, useRef } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoIngestionSection } from '../components/VideoIngestionSection';
import { RiskTimeline } from '../components/RiskTimeline';
import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';
import { MultiCameraGrid, type CameraFeedItem } from '../components/MultiCameraGrid';
import { 
  Camera, 
  RefreshCw, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  Activity,
  Truck,
  ShieldCheck,
  Send,
  XCircle,
  LayoutGrid,
  Maximize2
} from 'lucide-react';
import { getLoadingBays, type LoadingBay } from '../api/facilities';
import { useEvents } from '../hooks/useEvents';
import { useRealtimeTelemetry } from '../hooks/useRealtimeTelemetry';
import { generateTelemetryForVideo, type VideoTelemetryPayload } from '../types/telemetry';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

const INITIAL_VIDEO_PAYLOAD = generateTelemetryForVideo(
  'Rolling and dropping carton.mp4',
  18.4 * 1024 * 1024,
  'Loading Bay 01',
  '/videos/Rolling%20and%20dropping%20carton.mp4',
  60
);

export const LiveMonitoring: React.FC = () => {
  const [searchParams] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isConnected } = useRealtimeTelemetry();
  const { events } = useEvents();
  const [bays, setBays] = useState<LoadingBay[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [dispatched, setDispatched] = useState<boolean>(false);
  const [falsePositive, setFalsePositive] = useState<boolean>(false);
  
  // Shared playback state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(60);
  const [videoPayload, setVideoPayload] = useState<VideoTelemetryPayload>(INITIAL_VIDEO_PAYLOAD);
  const [viewMode, setViewMode] = useState<'SINGLE' | 'GRID'>('SINGLE');

  const handleGridFeedSelect = (feed: CameraFeedItem) => {
    const payload = generateTelemetryForVideo(
      feed.filename,
      18 * 1024 * 1024,
      feed.bay,
      feed.videoUrl,
      60
    );
    handleVideoSelect(payload);
    setViewMode('SINGLE');
  };

  const fetchCameraFeeds = async () => {
    try {
      const baysData = await getLoadingBays();
      setError(null);
      if (Array.isArray(baysData)) {
        setBays(baysData);
      }
    } catch (err: any) {
      console.warn('Failed to fetch facility bays:', err);
      setError('Unable to load optical telemetry data from facility service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameraFeeds();
  }, []);

  useEffect(() => {
    const videoParam = searchParams.get('video');
    const bayParam = searchParams.get('bay');
    if (videoParam) {
      const decodedVideo = decodeURIComponent(videoParam);
      const decodedBay = bayParam ? decodeURIComponent(bayParam) : 'Loading Bay';
      const videoUrl = `/videos/${encodeURIComponent(decodedVideo)}`;
      const payload = generateTelemetryForVideo(
        decodedVideo,
        18 * 1024 * 1024,
        decodedBay,
        videoUrl,
        60
      );
      handleVideoSelect(payload);
    }
  }, [searchParams]);

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
    setAcknowledged(false);
    setDispatched(false);
    setFalsePositive(false);
    setVideoDuration(payload.duration || 60);
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

  const currentTimelinePoints = videoPayload.timelineData || [];
  const activeEventAtTime = currentTimelinePoints.find(
    (e) => Math.abs(e.time - currentTime) <= 2 && (e.isPeak || e.event)
  );

  const peakRiskValue = activeEventAtTime 
    ? activeEventAtTime.frameRisk 
    : (currentTimelinePoints.length > 0 ? Math.max(...currentTimelinePoints.map(p => p.frameRisk), videoPayload.riskScore) : videoPayload.riskScore);

  const computedRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 
    peakRiskValue >= 80 ? 'CRITICAL' :
    peakRiskValue >= 60 ? 'HIGH' :
    peakRiskValue >= 35 ? 'MEDIUM' : 'LOW';

  const activeBehavior = activeEventAtTime?.event || videoPayload.behaviors[0] || 'Standard Warehouse Material Handling';

  // Dynamic explanation generation based on detected telemetry
  const isDropping = activeBehavior.toLowerCase().includes('drop') || activeBehavior.toLowerCase().includes('impact');
  const isDragging = activeBehavior.toLowerCase().includes('drag') || activeBehavior.toLowerCase().includes('friction');
  const isThrowing = activeBehavior.toLowerCase().includes('throw') || activeBehavior.toLowerCase().includes('toss');
  const isStepping = activeBehavior.toLowerCase().includes('step') || activeBehavior.toLowerCase().includes('crush');
  const isStacking = activeBehavior.toLowerCase().includes('stack') || activeBehavior.toLowerCase().includes('heavy');

  const whatHappenedText = activeEventAtTime?.event 
    ? `At ${activeEventAtTime.time}s: ${activeEventAtTime.event} detected via kinematic tracking (R(t) = ${activeEventAtTime.frameRisk}%).`
    : isDropping
    ? `Sudden vertical acceleration drop spike (>9.8 m/s²) recorded on carton item in ${videoPayload.bay}.`
    : isDragging
    ? `Continuous floor surface friction translation without lifting apparatus detected in ${videoPayload.bay}.`
    : isThrowing
    ? `Ballistic trajectory and abrupt momentum transfer observed on product unit in ${videoPayload.bay}.`
    : isStepping
    ? `Direct downward vertical load concentrated on carton top surface in ${videoPayload.bay}.`
    : isStacking
    ? `Heavy structural weight positioned atop lighter fragile parcels in ${videoPayload.bay}.`
    : `Continuous YOLO11 + ByteTrack optical surveillance active on ${videoPayload.bay}.`;

  const whyItMattersText = isDropping
    ? 'Freefall impact deceleration causes internal component fracturing, structural integrity failure, and concealed carton tearing.'
    : isDragging
    ? 'Floor abrasion compromises bottom box seals, risks moisture ingress, and leads to base carton puncture during transit.'
    : isThrowing
    ? 'Airborne momentum transfer leads to severe corner deformation, product breakage, and adjacent personnel safety risks.'
    : isStepping
    ? 'Foot pressure directly exceeds corrugated bursting test limits, crushing underlying merchandise and creating slip hazards.'
    : isStacking
    ? 'Inverted load hierarchy causes bottom-layer box collapse, stack destabilization, and catastrophic dock tipping.'
    : 'Live behavioral telemetry enables proactive damage prevention and ensures compliance with standard operating procedures.';

  const recommendedActionText = isDropping
    ? 'Halt conveyor/unloading sequence, inspect package corners for hidden structural compromise, and enforce two-handed placement.'
    : isDragging
    ? 'Provide hydraulic pallet truck or team-lift assistance. Prohibit floor dragging across warehouse bays.'
    : isThrowing
    ? 'Dispatch supervisor to coach operator on controlled hand-off placement. Tag carton for quality audit.'
    : isStepping
    ? 'Immediately instruct operator to step off carton; maintain clear designated walking lanes at all times.'
    : isStacking
    ? 'Restructure pallet stack: place heaviest KD packets and cartons on the base tier with lighter goods above.'
    : 'Continue real-time monitoring; all handling parameters currently within acceptable threshold margins.';

  const criticalEventsCount = events.filter(e => e.risk_level === 'Critical').length;

  return (
    <DataProvenanceOverlay
      endpoint="GET /api/bays + YOLO11 Stream"
      entity="LiveMonitoring"
      facilityScope={videoPayload.bay}
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1440px] mx-auto space-y-6 text-slate-900 p-4"
      >
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Camera className="w-6 h-6 text-blue-600" /> Real-Time Loading Bay Intelligence
            </h1>
            <p className="text-sm text-slate-500">
              Live multi-camera optical surveillance, kinematic anomaly tracking, and proactive damage prevention.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('SINGLE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'SINGLE'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Optical Deep-Dive</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'GRID'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>7-Camera Live Wall</span>
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono shadow-2xs">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-blue-500'}`} />
              <span className="text-slate-700 font-semibold">{isConnected ? 'WebSocket Live' : 'REST Active'}</span>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Operational Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Active Facility Bays</p>
              <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{bays.length || 4} Bays</p>
            </div>
            <Truck className="w-5 h-5 text-blue-600" />
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Critical Shift Incidents</p>
              <p className="text-xl font-bold font-mono text-rose-600 mt-0.5">{criticalEventsCount} Active</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Inference Engine</p>
              <p className="text-xs font-bold font-mono text-emerald-700 mt-1">YOLO11 + ByteTrack</p>
            </div>
            <Cpu className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Damage Prevention Index</p>
              <p className="text-xl font-bold font-mono text-emerald-600 mt-0.5">94.2 / 100</p>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* View Mode Switching: Multi-Camera Grid */}
        {viewMode === 'GRID' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <MultiCameraGrid
              onSelectFeed={handleGridFeedSelect}
              activeFeedFilename={videoPayload.filename}
            />
          </div>
        )}

        {/* View Mode Switching: Single Optical Stream Deep-Dive */}
        {viewMode === 'SINGLE' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Video Stream Replay / Live Player */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-950 rounded-xl overflow-hidden shadow-xl border border-slate-800">
                  <VideoPlayer
                    videoRef={videoRef}
                    videoUrl={videoPayload.videoUrl}
                    videoId={videoPayload.id}
                    timestamp={currentTime}
                    duration={videoDuration}
                    onDurationChange={handleDurationChange}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                    behaviour={activeBehavior}
                    riskScore={peakRiskValue}
                    riskLevel={computedRiskLevel}
                  />
                </div>
              </div>

              {/* Actionable AI Intelligence Panel */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-600" /> REAL-TIME AI TELEMETRY
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase ${
                      computedRiskLevel === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      computedRiskLevel === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      computedRiskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                      'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {computedRiskLevel} RISK ({peakRiskValue.toFixed(1)}%)
                    </span>
                  </div>

                  {/* Dynamic Telemetry What Happened */}
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">WHAT HAPPENED</p>
                    <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {whatHappenedText}
                    </p>
                  </div>

                  {/* Dynamic Why It Matters */}
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">WHY IT MATTERS</p>
                    <p className="text-slate-800 leading-relaxed bg-amber-50/60 p-3 rounded-lg border border-amber-100">
                      {whyItMattersText}
                    </p>
                  </div>

                  {/* Dynamic Recommended Action */}
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-blue-900 uppercase tracking-wider text-[10px]">RECOMMENDED INTERVENTION</p>
                    <p className="text-slate-800 font-semibold bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                      {recommendedActionText}
                    </p>
                  </div>

                  {/* Supervisor Actions */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                    {falsePositive ? (
                      <span className="w-full text-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold font-mono">
                        Marked False Positive
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setAcknowledged(true)}
                          disabled={acknowledged}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            acknowledged
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {acknowledged ? 'Acknowledged' : 'Acknowledge'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDispatched(true)}
                          disabled={dispatched}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            dispatched
                              ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                              : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          {dispatched ? 'Dispatched' : 'Dispatch'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setFalsePositive(true)}
                          className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                          title="Mark as false positive"
                        >
                          <XCircle className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Kinematic Risk Timeline & Scrubber */}
            <RiskTimeline
              timelineData={videoPayload.timelineData}
              currentTime={currentTime}
              videoDuration={videoDuration}
              compositeRiskScore={videoPayload.riskScore}
              peakRisk={peakRiskValue}
              onSeek={handleChartClick}
            />
          </>
        )}

        {/* Video Ingestion Section (Positioned Below Stream) */}
        <VideoIngestionSection onVideoSelect={handleVideoSelect} />
      </motion.div>
    </DataProvenanceOverlay>
  );
};

export default LiveMonitoring;
