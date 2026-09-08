import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEventById } from '../api/events';
import { getVideoById } from '../api/videos';
import type { Event } from '../types/event';
import { VideoPlayer } from '../components/VideoPlayer';
import { RiskBadge } from '../components/RiskBadge';
import { AssistantChat } from '../components/AssistantChat';
import { sanitizeUrl, sanitizeText } from '../lib/security';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, MapPin, Video, Info, Loader2, ShieldAlert, Camera } from 'lucide-react';

export const Incident: React.FC = () => {
  const { eventId, id } = useParams<{ eventId?: string; id?: string }>();
  const activeEventId = eventId || id;
  const [event, setEvent] = useState<Event | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Reset state during render when activeEventId route parameter changes
  const [prevEventId, setPrevEventId] = useState<string | undefined>(activeEventId);
  if (prevEventId !== activeEventId) {
    setPrevEventId(activeEventId);
    setImageError(false);
    setVideoDuration(undefined);
    setLoading(true);
    setEvent(null);
    setError(null);
  }

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
  
  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="font-medium text-sm">Loading incident data...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="glass-panel p-12 text-center max-w-[600px] mx-auto mt-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Incident Not Found</h2>
        <p className="text-slate-500 text-sm">
          The event <span className="font-mono font-semibold text-slate-700">{activeEventId}</span> could not be loaded or has been archived.
        </p>
        <div className="pt-2">
          <Link to="/incidents" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-blue-700 btn-interactive shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Return to Incident Log
          </Link>
        </div>
      </div>
    );
  }

  const safeEvidenceUrl = event.evidence_frame ? sanitizeUrl(event.evidence_frame) : '';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1400px] mx-auto space-y-6"
    >
      <div>
        <Link to="/incidents" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-4 group premium-transition hover:-translate-x-1">
          <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 premium-transition" /> Back to Incident Log
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              {event.behaviour}
              <RiskBadge level={event.risk_level} />
            </h1>
            <p className="text-slate-500 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> {event.timestamp}s</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {event.bay_id || 'Unassigned Bay'}</span>
              <span className="flex items-center gap-1"><Video className="w-4 h-4"/> {event.camera_id || 'CAM-01'}</span>
              <span>Object: #{event.object_id || 'N/A'}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">Risk Score</p>
            <p className="text-3xl font-bold text-slate-900">{event.risk_score}<span className="text-lg text-slate-400">/100</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <VideoPlayer 
            videoId={event.video_id} 
            timestamp={event.timestamp}
            duration={videoDuration}
            objectId={event.object_id}
            behaviour={event.behaviour}
            riskScore={event.risk_score}
            riskLevel={event.risk_level}
          />
          
          <div className="glass-panel p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary"/> Incident Details
            </h3>
            
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {event.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-200 hover:border-slate-300 cursor-default premium-transition shadow-sm">
                    #{sanitizeText(tag)}
                  </span>
                ))}
              </div>
            )}

            {safeEvidenceUrl && !imageError ? (
              <div className="mb-6 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Evidence Snapshot</p>
                <img 
                  src={safeEvidenceUrl} 
                  alt={`Evidence frame for ${event.event_id}`} 
                  className="rounded-md max-h-48 object-cover border border-slate-200"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="mb-6 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-slate-200/70 text-slate-600 shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-800">Optical Evidence Frame (T={event.timestamp}s)</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Stream frame logged to local NVR storage archive • {event.camera_id || 'CAM-01'}</p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Description</h4>
                <p className="text-slate-700 leading-relaxed">{event.description}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">AI Reasoning</h4>
                <p className="text-slate-700 leading-relaxed">{event.reason}</p>
              </div>
              {event.recommended_action && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-medium text-slate-500 mb-1">Recommended Action</h4>
                  <p className="text-primary font-medium">{event.recommended_action}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6 h-full flex flex-col">
          <AssistantChat className="h-full min-h-[500px]" />
        </div>
      </div>
    </motion.div>
  );
};
