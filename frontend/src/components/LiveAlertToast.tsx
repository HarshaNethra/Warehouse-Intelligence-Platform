import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertOctagon, X, Eye } from 'lucide-react';
import { useRealtimeTelemetry } from '../hooks/useRealtimeTelemetry';
import { IncidentReviewModal } from './IncidentReviewModal';
import type { Event } from '../types/event';

export interface AlertNotification {
  id: string;
  eventId?: string;
  title: string;
  bay: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  confidence?: number;
  behaviour?: string;
  message: string;
  timestamp: string;
  timestampSeconds?: number;
  accelerationY?: number;
  velocity?: number;
}

export const LiveAlertToast: React.FC = () => {
  const { currentFrame } = useRealtimeTelemetry();
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const lastAlertTimestampRef = useRef<number>(0);

  // Review Modal State
  const [reviewModalEvent, setReviewModalEvent] = useState<Event | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

  // Listen for WebSocket Telemetry spikes with throttle (at least 8 seconds between notifications)
  useEffect(() => {
    if (!currentFrame) return;

    const now = Date.now();
    if (
      (currentFrame.risk_score >= 60 || currentFrame.status === 'CRITICAL' || currentFrame.status === 'HIGH') &&
      now - lastAlertTimestampRef.current > 8000
    ) {
      lastAlertTimestampRef.current = now;
      const riskScore = currentFrame.risk_score;
      const isCrit = currentFrame.status === 'CRITICAL' || riskScore >= 80;
      
      const newAlert: AlertNotification = {
        id: `alert-${now}-${Math.random().toString(36).substr(2, 4)}`,
        eventId: `EVT-${Math.floor(now / 1000)}`,
        title: 'POTENTIAL SAFETY INCIDENT',
        bay: currentFrame.bay_id || 'Loading Bay 01',
        riskLevel: isCrit ? 'CRITICAL' : 'HIGH',
        riskScore: riskScore,
        confidence: 0.91,
        behaviour: isCrit ? 'Product Drop Detected' : 'Unsafe Material Translation',
        message: `Kinematic anomaly flagged in ${currentFrame.bay_id || 'Dock Bay'}. Sudden vertical acceleration drop spike (>9.8 m/s²) recorded.`,
        timestamp: new Date().toLocaleTimeString(),
        timestampSeconds: 6.0,
      };

      setAlerts((prev) => [newAlert, ...prev.slice(0, 1)]);
    }
  }, [currentFrame]);

  // Global event listener for custom UI triggered alerts
  useEffect(() => {
    const handleCustomAlert = (e: CustomEvent<AlertNotification>) => {
      if (e.detail) {
        setAlerts((prev) => [e.detail, ...prev.slice(0, 1)]);
      }
    };

    window.addEventListener('wms:safety-alert' as any, handleCustomAlert as any);
    return () => window.removeEventListener('wms:safety-alert' as any, handleCustomAlert as any);
  }, []);

  const handleDismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleReviewIncident = (alert: AlertNotification) => {
    handleDismiss(alert.id);
    
    // Construct synthetic/normalized Event object for modal review
    const synthEvent: Event = {
      event_id: alert.eventId || `EVT-${Date.now()}`,
      video_id: 'Rolling and dropping carton.mp4',
      timestamp: alert.timestampSeconds || 6.0,
      timestamp_seconds: alert.timestampSeconds || 6.0,
      bay_id: alert.bay,
      camera_id: 'CAM-01',
      object_id: 42,
      behaviour: alert.behaviour || alert.title || 'Product Drop Detected',
      risk_score: alert.riskScore,
      risk_level: alert.riskLevel === 'CRITICAL' ? 'Critical' : alert.riskLevel === 'HIGH' ? 'High' : 'Medium',
      confidence: alert.confidence || 0.91,
      description: alert.message,
      reason: 'Freefall impact acceleration spike detected exceeding packaging tolerance.',
      recommended_action: 'Halt conveyor sequence, inspect package corners, and coach dock operators on safe handoff.',
      status: 'PENDING_REVIEW',
      video_reference: '/videos/Rolling%20and%20dropping%20carton.mp4#t=6.0',
    };

    setReviewModalEvent(synthEvent);
    setIsReviewModalOpen(true);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-3 max-w-sm sm:max-w-md w-full px-2 sm:px-0 pointer-events-none">
        <AnimatePresence>
          {alerts.map((alert) => {
            const isCrit = alert.riskLevel === 'CRITICAL';
            const isHigh = alert.riskLevel === 'HIGH';

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto rounded-2xl p-4 sm:p-5 shadow-2xl border backdrop-blur-md text-slate-900 transition-all ${
                  isCrit
                    ? 'bg-red-50/95 border-red-300 ring-2 ring-red-500/20'
                    : isHigh
                    ? 'bg-orange-50/95 border-orange-300 ring-2 ring-orange-500/20'
                    : 'bg-amber-50/95 border-amber-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl text-white shrink-0 mt-0.5 ${
                        isCrit ? 'bg-red-600 animate-pulse shadow-md' : 'bg-orange-600'
                      }`}
                    >
                      {isCrit ? <AlertOctagon className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                          POTENTIAL SAFETY INCIDENT
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          {alert.bay} • {alert.timestamp}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 truncate mt-1">
                        {alert.behaviour || alert.title}
                      </h4>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors shrink-0"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-700 mt-2 font-medium leading-relaxed bg-white/70 p-2.5 rounded-xl border border-slate-200/60">
                  {alert.message}
                </p>

                <p className="text-[11px] text-slate-500 italic mt-2">
                  "Review the video evidence before taking action."
                </p>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-3 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                      Severity: {alert.riskLevel} ({alert.riskScore.toFixed(1)})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                      Confidence: {Math.round((alert.confidence || 0.91) * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-1 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => handleDismiss(alert.id)}
                      className="px-3 py-1.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReviewIncident(alert)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review Incident</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* HITL Review Modal Triggered from Toast Notification */}
      <IncidentReviewModal
        event={reviewModalEvent}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onStatusUpdated={() => setIsReviewModalOpen(false)}
      />
    </>
  );
};

export default LiveAlertToast;
