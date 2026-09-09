import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEventById, acknowledgeIncident, dispatchIncident, markFalsePositiveIncident } from '../api/events';
import { getVideoById } from '../api/videos';
import type { Event } from '../types/event';
import { useAuth } from '../context/AuthContext';
import { VideoPlayer } from '../components/VideoPlayer';
import { RiskBadge } from '../components/RiskBadge';
import { AssistantChat } from '../components/AssistantChat';
import { formatTimestamp } from '../utils/formatters';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, ShieldAlert, CheckCircle2, Send, XCircle } from 'lucide-react';
import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';

export const Incident: React.FC = () => {
  const { eventId, id } = useParams<{ eventId?: string; id?: string }>();
  const activeEventId = eventId || id;
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isFalsePositive, setIsFalsePositive] = useState(false);

  useEffect(() => {
    if (!activeEventId) return;
    let isMounted = true;

    getEventById(activeEventId)
      .then((data) => {
        if (!isMounted) return;
        setEvent(data);
        if (data.video_id) {
          getVideoById(data.video_id)
            .then((v) => {
              if (isMounted && v?.duration) {
                setVideoDuration(v.duration);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (isMounted) setError(err?.message || 'Failed to fetch incident details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeEventId]);

  const handleAcknowledge = async () => {
    if (!event || isAcknowledging) return;
    setIsAcknowledging(true);
    try {
      const updated = await acknowledgeIncident(event.event_id);
      setEvent(prev => prev ? {
        ...prev,
        status: 'ACKNOWLEDGED',
        acknowledged_by_user_id: updated.acknowledged_by_user_id || user?.email || user?.id || 'operator',
        acknowledged_at: updated.acknowledged_at || new Date().toISOString()
      } : null);
    } catch (err) {
      console.error('Failed to acknowledge incident:', err);
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleDispatch = async () => {
    if (!event || isDispatching) return;
    setIsDispatching(true);
    try {
      const updated = await dispatchIncident(event.event_id);
      setEvent(prev => prev ? {
        ...prev,
        status: 'DISPATCHED',
        acknowledged_by_user_id: updated.acknowledged_by_user_id || prev.acknowledged_by_user_id || user?.email || user?.id || 'operator',
        acknowledged_at: updated.acknowledged_at || prev.acknowledged_at || new Date().toISOString()
      } : null);
    } catch (err) {
      console.error('Failed to dispatch incident:', err);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleFalsePositive = async () => {
    if (!event || isFalsePositive) return;
    setIsFalsePositive(true);
    try {
      const updated = await markFalsePositiveIncident(event.event_id, 'Marked false positive by supervisor');
      setEvent(prev => prev ? {
        ...prev,
        status: 'FALSE_POSITIVE',
        acknowledged_by_user_id: updated.acknowledged_by_user_id || prev.acknowledged_by_user_id || user?.email || user?.id || 'operator',
        acknowledged_at: updated.acknowledged_at || prev.acknowledged_at || new Date().toISOString()
      } : null);
    } catch (err) {
      console.error('Failed to mark false positive:', err);
    } finally {
      setIsFalsePositive(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[450px] bg-slate-200 rounded-xl" />
          <div className="h-[450px] bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="bg-white p-12 text-center max-w-[600px] mx-auto mt-12 space-y-4 border border-slate-200 rounded-xl text-slate-900 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Incident Not Found</h2>
        <p className="text-slate-500 text-sm">
          The event <span className="font-mono font-semibold text-slate-800">{activeEventId}</span> could not be loaded.
        </p>
        <div className="pt-2">
          <Link to="/incidents" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 btn-interactive shadow-xs">
            <ArrowLeft className="w-4 h-4" /> Return to Incidents
          </Link>
        </div>
      </div>
    );
  }

  let rawVideoUrl = event.video_reference || (event.video_id ? `/videos/${encodeURIComponent(event.video_id)}` : '');
  const targetTs = event.timestamp_seconds ?? event.timestamp;
  if (targetTs && targetTs > 0 && !rawVideoUrl.includes('#t=')) {
    rawVideoUrl = `${rawVideoUrl}#t=${targetTs.toFixed(2)}`;
  }
  const videoUrl = rawVideoUrl;

  const statusUpper = (event.status || 'UNRESOLVED').toUpperCase();
  const isAcknowledged = statusUpper === 'ACKNOWLEDGED';
  const isDispatched = statusUpper === 'DISPATCHED';
  const isFalsePos = statusUpper === 'FALSE_POSITIVE';

  return (
    <DataProvenanceOverlay
      endpoint={`/api/events/${event.event_id}`}
      facilityScope={event.facility_id || 'FAC-001'}
      entity="Event + InferenceRun"
      filter={`Event ID: ${event.event_id}`}
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1440px] mx-auto space-y-6 text-slate-900 p-4"
      >
      <div>
        <Link to="/incidents" className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-blue-600 mb-3 group transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Back to Incident Queue
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                INCIDENT #{event.event_id}
              </span>
              <RiskBadge level={event.risk_level} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {event.behaviour}
            </h1>
            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-3 font-mono mt-1">
              <span>{event.bay_id || 'Loading Bay 01'}</span>
              <span>·</span>
              <span>{event.camera_id || 'Camera 02'}</span>
              <span>·</span>
              <span>{formatTimestamp(event.timestamp)}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isFalsePos ? (
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold font-mono flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-slate-500" /> False Positive Reviewed
              </span>
            ) : isDispatched ? (
              <span className="px-3 py-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold font-mono flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Response Team Dispatched
              </span>
            ) : (
              <>
                {!isAcknowledged ? (
                  <button
                    type="button"
                    onClick={handleAcknowledge}
                    disabled={isAcknowledging}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-xs btn-interactive"
                  >
                    {isAcknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Acknowledge Incident</span>
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-mono">
                    ✓ Acknowledged
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleDispatch}
                  disabled={isDispatching}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-xs btn-interactive"
                >
                  {isDispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Dispatch Supervisor</span>
                </button>

                <button
                  type="button"
                  onClick={handleFalsePositive}
                  disabled={isFalsePositive}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 border border-slate-200"
                  title="Mark as false positive for ML feedback"
                >
                  {isFalsePositive ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 text-slate-500" />}
                  <span>False Positive</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Replay Player */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-950 rounded-xl overflow-hidden shadow-xl border border-slate-800">
            <VideoPlayer 
              videoUrl={videoUrl}
              videoId={event.video_id || `Incident ${event.event_id}`} 
              timestamp={event.timestamp}
              duration={videoDuration}
              objectId={event.object_id}
              behaviour={event.behaviour}
              riskScore={event.risk_score}
              riskLevel={event.risk_level}
            />
          </div>
        </div>
        
        {/* Right Column: Incident Intelligence Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                AI INCIDENT INTELLIGENCE
              </span>
              <span className="text-xs font-bold font-mono text-orange-600">
                Score: {event.risk_score} / 100
              </span>
            </div>

            {/* AI Summary */}
            <div className="space-y-1 text-xs">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">AI SUMMARY</p>
              <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                {event.description}
              </p>
            </div>

            {/* Detected Sequence Steps */}
            <div className="space-y-2 text-xs">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">DETECTED SEQUENCE</p>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center gap-2">
                  <span className="font-bold text-blue-600">01</span>
                  <span className="text-slate-800">Initial object movement detected</span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center gap-2">
                  <span className="font-bold text-blue-600">02</span>
                  <span className="text-slate-800">{event.behaviour} trajectory initialized</span>
                </div>
                <div className="p-2 bg-orange-50 rounded border border-orange-100 flex items-center gap-2 text-orange-900">
                  <span className="font-bold text-orange-600">03</span>
                  <span className="font-semibold">Risk threshold exceeded (&gt;{event.risk_score} score)</span>
                </div>
              </div>
            </div>

            {/* Why High Risk */}
            <div className="space-y-1 text-xs">
              <p className="font-bold text-orange-900 uppercase tracking-wider text-[10px]">WHY HIGH RISK</p>
              <p className="text-slate-800 leading-relaxed bg-orange-50/60 p-3 rounded-lg border border-orange-100">
                {event.reason}
              </p>
            </div>

            {/* Recommended Action */}
            {event.recommended_action && (
              <div className="space-y-1 text-xs">
                <p className="font-bold text-blue-900 uppercase tracking-wider text-[10px]">RECOMMENDED ACTION</p>
                <p className="text-slate-800 font-semibold bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                  {event.recommended_action}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grounded Conversational AI Supervisor Assistant Section */}
      <div className="pt-4">
        <h3 className="text-base font-bold text-slate-900 mb-3">AI Incident Q&A Assistant</h3>
        <AssistantChat className="h-[450px]" />
      </div>
    </motion.div>
    </DataProvenanceOverlay>
  );
};

export default Incident;
