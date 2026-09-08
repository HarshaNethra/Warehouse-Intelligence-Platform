import React, { useState, useEffect } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { Activity, AlertTriangle, Camera, RefreshCw, ShieldCheck, BellRing, BellOff } from 'lucide-react';
import { getVideos } from '../api/videos';
import { useSettings } from '../hooks/useSettings';
import type { VideoMetadata } from '../types/video';

export const LiveMonitoring: React.FC = () => {
  const { settings } = useSettings();
  const [cameraFeed, setCameraFeed] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCameraFeeds = async () => {
    try {
      const data = await getVideos();
      setError(null);
      if (Array.isArray(data) && data.length > 0) {
        // Lock to primary surveillance camera CAM-01 (Loading Bay 4)
        const primary = data.find(v => (v.video_id || '').includes('cam01') || (v.filename || '').toLowerCase().includes('bay4')) || data[0];
        setCameraFeed(primary);
      } else {
        setCameraFeed(null);
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

  useEffect(() => {
    let isMounted = true;
    getVideos()
      .then((data) => {
        if (!isMounted) return;
        setError(null);
        if (Array.isArray(data) && data.length > 0) {
          // Lock to primary surveillance camera CAM-01 (Loading Bay 4)
          const primary =
            data.find(
              (v) =>
                (v.video_id || '').includes('cam01') ||
                (v.filename || '').toLowerCase().includes('bay4')
            ) || data[0];
          setCameraFeed(primary);
        } else {
          setCameraFeed(null);
        }
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.warn('Failed to fetch camera feed:', err);
        setError('Unable to load optical camera feed from video service');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeVideo = cameraFeed;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
            <Camera className="w-6 h-6 text-primary" /> Live Surveillance & Telemetry
          </h1>
          <p className="text-slate-500">Dedicated Primary Optical Channel (CAM-01) • Real-Time Object Detection</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Surveillance Online
          </span>
          <span className="text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            Engine: <span className="font-semibold text-slate-900">{settings.inferenceDevice === 'cuda' ? 'TensorRT GPU' : 'ONNX CPU Runtime'}</span>
          </span>
        </div>
      </div>

      {/* Single Dedicated Camera Info Bar */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Primary Surveillance Channel:
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-primary text-white shadow-xs">
                CAM-01
              </span>
              <span className="text-xs font-semibold text-slate-700">
                (Loading Bay 4)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dedicated optical input stream • 1080p 30 FPS • ByteTrack Persistent ID Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Optical Stream
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="text-xs font-medium text-slate-600 hover:text-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 btn-interactive"
            title="Reconnect optical feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="font-semibold text-amber-700 hover:underline"
          >
            Retry Feed
          </button>
        </div>
      )}

      {/* Main Viewport & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <VideoPlayer
            videoId="CAM-01 - Loading Bay 4"
            duration={activeVideo ? activeVideo.duration : 60}
          />

          {/* Active Camera Telemetry Banner */}
          <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <span><strong>Camera:</strong> <span className="font-mono text-slate-800">CAM-01 (Loading Bay 4)</span></span>
              <span><strong>File:</strong> <span className="font-mono text-slate-800">{activeVideo?.filename || 'loading_bay4_shift1.mp4'}</span></span>
              <span><strong>Resolution:</strong> {activeVideo?.width || 1920}x{activeVideo?.height || 1080}</span>
              <span><strong>Framerate:</strong> {activeVideo?.fps || 30} FPS</span>
              <span><strong>Duration:</strong> {activeVideo?.duration || 60}s</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Stream Status: {activeVideo?.status ? activeVideo.status.toUpperCase() : 'ONLINE'}
            </div>
          </div>
        </div>
        
        {/* Right side stats panel */}
        <div className="space-y-6">
          <div className="glass-panel p-5">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Active Detection Status</h3>
            
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wide">Object Detector</p>
                <p className="text-sm font-semibold text-primary">YOLOv8 Nano (COCO)</p>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wide">Tracker Engine</p>
                <p className="text-sm font-semibold text-emerald-600">ByteTrack Persistent ID</p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 border-l-4 border-amber-500">
            <h3 className="text-xs font-bold text-amber-700 flex items-center gap-2 uppercase tracking-wider mb-2">
              <AlertTriangle className="w-4 h-4" /> Violation Rules Active
            </h3>
            <p className="text-sm text-slate-600">
              PPE Detection, Proximity Warnings, Restricted Zone Entry, High-Speed Forklift Tracking.
            </p>
          </div>

          <div className="glass-panel p-5 border-l-4 border-rose-500">
            <h3 className="text-xs font-bold text-rose-700 flex items-center justify-between uppercase tracking-wider mb-2">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4" /> Risk Scoring Engine
              </span>
              <span className="text-[11px] font-mono font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                {settings.riskThreshold}%
              </span>
            </h3>
            <p className="text-sm text-slate-600">
              Collision Overlap + Velocity Delta + Trajectory Deviation Threshold = {(settings.riskThreshold / 100).toFixed(2)}.
            </p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-medium">
              {settings.enableAlerts ? (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-emerald-600" /> Dock push notifications armed
                </span>
              ) : (
                <span className="text-slate-500 flex items-center gap-1.5">
                  <BellOff className="w-3.5 h-3.5 text-slate-400" /> Push notifications muted
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
