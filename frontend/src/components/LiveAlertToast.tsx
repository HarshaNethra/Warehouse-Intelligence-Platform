import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertOctagon, X, ArrowUpRight, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRealtimeTelemetry } from '../hooks/useRealtimeTelemetry';
import { soundSynthesizer } from '../utils/soundAlerts';

export interface AlertNotification {
  id: string;
  title: string;
  bay: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  message: string;
  timestamp: string;
  accelerationY?: number;
  velocity?: number;
}

export const LiveAlertToast: React.FC = () => {
  const navigate = useNavigate();
  const { currentFrame } = useRealtimeTelemetry();
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(soundSynthesizer.getMuted());

  // Listen for WebSocket Telemetry spikes
  useEffect(() => {
    if (!currentFrame) return;

    if (currentFrame.risk_score >= 60 || currentFrame.status === 'CRITICAL' || currentFrame.status === 'HIGH') {
      const newAlert: AlertNotification = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: currentFrame.status === 'CRITICAL' ? 'Critical Safety Incident' : 'High Risk Anomaly Detected',
        bay: currentFrame.bay_id || 'Loading Bay 01',
        riskLevel: currentFrame.status === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        riskScore: currentFrame.risk_score,
        message: `Hazardous kinematic movement flagged in ${currentFrame.bay_id || 'Dock Bay'} (Score: ${currentFrame.risk_score.toFixed(1)}).`,
        timestamp: new Date().toLocaleTimeString(),
      };

      setAlerts((prev) => [newAlert, ...prev.slice(0, 2)]);
      soundSynthesizer.playAlert(newAlert.riskLevel);
    }
  }, [currentFrame]);

  // Global event listener for custom UI triggered alerts (e.g. video timeline peaks)
  useEffect(() => {
    const handleCustomAlert = (e: CustomEvent<AlertNotification>) => {
      if (e.detail) {
        setAlerts((prev) => [e.detail, ...prev.slice(0, 2)]);
        soundSynthesizer.playAlert(e.detail.riskLevel);
      }
    };

    window.addEventListener('wms:safety-alert' as any, handleCustomAlert as any);
    return () => window.removeEventListener('wms:safety-alert' as any, handleCustomAlert as any);
  }, []);

  const handleDismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundSynthesizer.setMuted(nextMuted);
  };

  const handleInspect = (alert: AlertNotification) => {
    handleDismiss(alert.id);
    navigate('/');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
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
              className={`pointer-events-auto rounded-xl p-4 shadow-2xl border backdrop-blur-md text-slate-900 ${
                isCrit
                  ? 'bg-red-50/95 border-red-300 ring-2 ring-red-500/20'
                  : isHigh
                  ? 'bg-orange-50/95 border-orange-300 ring-2 ring-orange-500/20'
                  : 'bg-amber-50/95 border-amber-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg text-white ${
                      isCrit ? 'bg-red-600 animate-pulse' : 'bg-orange-600'
                    }`}
                  >
                    {isCrit ? <AlertOctagon className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      {alert.title}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500 font-semibold">
                      {alert.bay} • {alert.timestamp}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 mt-2 font-medium leading-relaxed">
                {alert.message}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/60 pt-2.5">
                <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-800">
                  Risk Score: {alert.riskScore.toFixed(1)}
                </span>

                <button
                  type="button"
                  onClick={() => handleInspect(alert)}
                  className="px-3 py-1 bg-slate-900 hover:bg-blue-600 text-white rounded-md text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                >
                  <span>Inspect Feed</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
