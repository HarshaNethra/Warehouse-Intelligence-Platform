import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  X, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Cpu, 
  FileText, 
  User, 
  AlertTriangle
} from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { RiskTimeline } from './RiskTimeline';
import { getRiskAtTime, generateTelemetryForVideo } from '../types/telemetry';
import type { Event } from '../types/event';
import { useAuth } from '../context/AuthContext';
import { 
  confirmIncident, 
  markFalsePositiveIncident, 
  dismissIncident, 
  markNeedsInvestigationIncident 
} from '../api/events';
import { formatTimecode } from '../utils/formatters';

export interface IncidentReviewModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: (updatedEvent: Event) => void;
}

export const IncidentReviewModal: React.FC<IncidentReviewModalProps> = ({
  event,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial video seek position to event timestamp when modal opens
  React.useEffect(() => {
    if (event) {
      const targetTs = event.timestamp_seconds ?? event.timestamp ?? 0;
      setCurrentTime(targetTs);
      setNotes(event.review_notes || '');
      setError(null);
    }
  }, [event]);

  let rawVideoUrl = event?.video_reference || (event?.video_id ? `/videos/${encodeURIComponent(event.video_id)}` : '/videos/Rolling%20and%20dropping%20carton.mp4');
  const targetTs = event?.timestamp_seconds ?? event?.timestamp;
  if (targetTs && targetTs > 0 && !rawVideoUrl.includes('#t=')) {
    rawVideoUrl = `${rawVideoUrl}#t=${targetTs.toFixed(2)}`;
  }
  const videoUrl = rawVideoUrl;

  const videoPayload = useMemo(() => {
    if (!event) return null;
    return generateTelemetryForVideo(
      event.video_id || event.behaviour || 'Incident Evidence Stream',
      18 * 1024 * 1024,
      event.bay_id || 'Loading Bay 01',
      videoUrl,
      videoDuration || 60
    );
  }, [event, videoUrl, videoDuration]);

  if (!isOpen || !event) return null;

  // Single source of truth temporal risk state for current video time
  const timelineData = videoPayload?.timelineData || [];
  const temporalState = getRiskAtTime(timelineData, currentTime);
  const peakRisk = event.risk_score || temporalState.peakRisk;
  const confidencePercent = Math.round((event.confidence ?? 0.91) * 100);

  const currentStatusUpper = (event.status || 'PENDING_REVIEW').toUpperCase();

  const handleDecision = async (decision: 'CONFIRMED' | 'FALSE_POSITIVE' | 'NEEDS_INVESTIGATION' | 'DISMISSED') => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      let updated: Event;
      if (decision === 'CONFIRMED') {
        updated = await confirmIncident(event.event_id, notes);
      } else if (decision === 'FALSE_POSITIVE') {
        updated = await markFalsePositiveIncident(event.event_id, notes);
      } else if (decision === 'NEEDS_INVESTIGATION') {
        updated = await markNeedsInvestigationIncident(event.event_id, notes);
      } else {
        updated = await dismissIncident(event.event_id, notes);
      }

      if (onStatusUpdated) {
        onStatusUpdated(updated);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to submit review decision:', err);
      setError(err?.message || 'Failed to submit decision. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimelineSeek = (seconds: number) => {
    setCurrentTime(seconds);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider bg-red-950/80 px-2.5 py-0.5 rounded border border-red-800">
                    POTENTIAL SAFETY INCIDENT
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {event.event_id}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                  Human-in-the-Loop Safety Review: {event.behaviour}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Responsible AI Decision Support Notice Banner */}
          <div className="px-4 sm:px-5 py-2.5 bg-blue-50 border-b border-blue-100 text-blue-900 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 animate-pulse" />
              <span className="font-semibold leading-normal">
                <strong>Decision-Support Safeguard:</strong> WitWatch presents AI predictions as potential safety risks. Review video evidence below before confirming or dismissing.
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-white text-blue-700 px-2 py-0.5 rounded border border-blue-200 shrink-0 hidden sm:inline">
              No Automated Punitive Decisions
            </span>
          </div>

          {/* Body Content - Scrollable Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#F5F7FA]">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Columns: Synced Video Player & Kinematic Timeline */}
              <div className="lg:col-span-2 space-y-4">
                {/* Embedded Video Evidence Player */}
                <div className="bg-slate-950 rounded-xl overflow-hidden shadow-xl border border-slate-800">
                  <VideoPlayer
                    videoUrl={videoUrl}
                    videoId={`${event.bay_id || 'Loading Bay'} - ${event.behaviour}`}
                    currentTime={currentTime}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                    onDurationChange={(d) => setVideoDuration(d)}
                    behaviour={event.behaviour}
                    riskScore={peakRisk}
                    timelineData={timelineData}
                  />
                </div>

                {/* Kinematic Timeline Scrubber */}
                <RiskTimeline
                  timelineData={timelineData}
                  currentTime={currentTime}
                  videoDuration={videoDuration}
                  compositeRiskScore={peakRisk}
                  peakRisk={peakRisk}
                  onSeek={handleTimelineSeek}
                />
              </div>

              {/* Right Column: Grounded AI Evidence & Perception Metrics */}
              <div className="space-y-4">
                
                {/* Risk vs Perception Confidence Panel */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                    <span>EVIDENCE METRICS</span>
                    <span className="text-[10px] font-mono text-slate-400 font-normal">YOLO11 Perception</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 bg-red-50/70 border border-red-200 rounded-lg">
                      <p className="text-[10px] text-red-700 font-bold uppercase">Peak Risk Score</p>
                      <p className="text-lg font-bold text-red-600 mt-0.5">{peakRisk.toFixed(1)} / 100</p>
                      <p className="text-[10px] text-red-500 font-sans mt-0.5">Behavior Threat Level</p>
                    </div>

                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                      <p className="text-[10px] text-indigo-700 font-bold uppercase">AI Confidence</p>
                      <p className="text-lg font-bold text-indigo-600 mt-0.5">{confidencePercent}%</p>
                      <p className="text-[10px] text-indigo-500 font-sans mt-0.5">Classification Certainty</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs pt-1">
                    <div className="flex items-center justify-between text-slate-600 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                      <span>Event Timestamp:</span>
                      <strong className="text-slate-900">{formatTimecode(event.timestamp_seconds ?? event.timestamp)} (t={event.timestamp}s)</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                      <span>Tracked Object ID:</span>
                      <strong className="text-slate-900">OBJ_CARTON #{event.object_id || 42}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 font-mono text-[11px] bg-slate-50 p-2 rounded border border-slate-100">
                      <span>Loading Bay:</span>
                      <strong className="text-slate-900">{event.bay_id || 'Loading Bay 01'}</strong>
                    </div>
                  </div>
                </div>

                {/* Grounded AI Explanation Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Cpu className="w-3.5 h-3.5 text-blue-600" />
                    AI-GENERATED EXPLANATION
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">WHAT HAPPENED</p>
                      <p className="text-slate-800 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        {event.description || 'Abrupt momentum drop spike (>9.8 m/s²) recorded on package during manual dock handling.'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">WHY IT WAS FLAGGED</p>
                      <p className="text-slate-800 mt-1 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100 leading-relaxed">
                        {event.reason || 'Impact deceleration exceeds standard corrugated packaging tolerance thresholds.'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">WHAT TO REVIEW</p>
                      <p className="text-slate-800 mt-1 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100 leading-relaxed">
                        {event.recommended_action || 'Inspect carton corners for concealed damage and verify operator adherence to two-handed lifting.'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Human Supervisor Review & Decision Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    HUMAN SUPERVISOR REVIEW DECISION
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-500">Current Lifecycle State:</span>
                  <span className={`px-2.5 py-0.5 rounded font-bold uppercase ${
                    currentStatusUpper === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    currentStatusUpper === 'FALSE_POSITIVE' ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                    currentStatusUpper === 'NEEDS_INVESTIGATION' ? 'bg-cyan-100 text-cyan-800 border border-cyan-300' :
                    currentStatusUpper === 'DISMISSED' ? 'bg-gray-100 text-gray-700 border border-gray-300' :
                    'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                  }`}>
                    {currentStatusUpper.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Review Notes Area */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reviewer Notes & Action Rationale (Optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record supervisor observations, package condition audit results, or reason for dismissal..."
                  rows={2}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-sans"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>Reviewer: <strong className="text-slate-800">{user?.full_name || user?.email || 'Supervisor Session'}</strong></span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecision('CONFIRMED')}
                    disabled={submitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Incident</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision('FALSE_POSITIVE')}
                    disabled={submitting}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 text-slate-500" />
                    <span>Mark False Positive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision('NEEDS_INVESTIGATION')}
                    disabled={submitting}
                    className="px-4 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-cyan-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Under Investigation</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision('DISMISSED')}
                    disabled={submitting}
                    className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default IncidentReviewModal;
