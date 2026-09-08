import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Cpu, Sliders, ShieldCheck, CheckCircle2, RefreshCw, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../api/endpoints';
import { useSettings } from '../hooks/useSettings';
import { DEFAULT_SETTINGS } from '../types/settings';

export const Settings: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSettings();

  const [inferenceDevice, setInferenceDevice] = useState<'cuda' | 'cpu'>(settings.inferenceDevice);
  const [riskThreshold, setRiskThreshold] = useState<number>(settings.riskThreshold);
  const [enableAlerts, setEnableAlerts] = useState<boolean>(settings.enableAlerts);
  const [systemHealth, setSystemHealth] = useState<{ status: string; service: string } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string>('Settings updated successfully');

  // Keep local form in sync if global settings change externally during render
  const [prevSettings, setPrevSettings] = useState(settings);
  if (prevSettings !== settings) {
    setPrevSettings(settings);
    setInferenceDevice(settings.inferenceDevice);
    setRiskThreshold(settings.riskThreshold);
    setEnableAlerts(settings.enableAlerts);
  }

  const checkHealth = async () => {
    setCheckingHealth(true);
    try {
      const data = await apiClient.get<{ status: string; service: string }>(API_ENDPOINTS.HEALTH);
      setSystemHealth(data);
    } catch {
      setSystemHealth(null);
    } finally {
      setCheckingHealth(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<{ status: string; service: string }>(API_ENDPOINTS.HEALTH)
      .then((data) => {
        if (isMounted) setSystemHealth(data);
      })
      .catch(() => {
        if (isMounted) setSystemHealth(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      inferenceDevice,
      riskThreshold,
      enableAlerts,
    });
    setSavedMessage('Settings updated and applied across platform');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    resetSettings();
    setInferenceDevice(DEFAULT_SETTINGS.inferenceDevice);
    setRiskThreshold(DEFAULT_SETTINGS.riskThreshold);
    setEnableAlerts(DEFAULT_SETTINGS.enableAlerts);
    setSavedMessage('Settings reset to system defaults');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1000px] mx-auto space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" /> Platform Settings & Engine Control
        </h1>
        <p className="text-slate-500">
          Configure real-time inference hyperparameters, notification triggers, and edge connectivity.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* System Health Status Panel */}
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Backend System Status
            </h2>
            <button
              type="button"
              onClick={checkHealth}
              disabled={checkingHealth}
              className="text-xs font-medium text-slate-600 hover:text-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 btn-interactive"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">FastAPI Endpoint</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">http://127.0.0.1:8000/api</p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Health Status</p>
              <p className={`text-sm font-semibold mt-1 flex items-center gap-1.5 ${
                systemHealth ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${systemHealth ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {systemHealth ? 'Online & Healthy' : 'Fallback / Mock Mode'}
              </p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">Storage Engine</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">SQLite3 Local Database</p>
            </div>
          </div>
        </div>

        {/* Inference Settings */}
        <div className="glass-panel p-6 space-y-6">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-primary" /> Vision Inference Device
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between premium-transition ${
              inferenceDevice === 'cuda' 
                ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20' 
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
              <div>
                <p className="font-semibold text-sm text-slate-900">CUDA / GPU Acceleration</p>
                <p className="text-xs text-slate-500 mt-0.5">NVIDIA TensorRT acceleration (120 FPS target)</p>
              </div>
              <input
                type="radio"
                name="device"
                value="cuda"
                checked={inferenceDevice === 'cuda'}
                onChange={() => setInferenceDevice('cuda')}
                className="text-primary focus:ring-primary h-4 w-4"
              />
            </label>

            <label className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between premium-transition ${
              inferenceDevice === 'cpu' 
                ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20' 
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
              <div>
                <p className="font-semibold text-sm text-slate-900">CPU Execution</p>
                <p className="text-xs text-slate-500 mt-0.5">Standard ONNX/OpenCV thread pool</p>
              </div>
              <input
                type="radio"
                name="device"
                value="cpu"
                checked={inferenceDevice === 'cpu'}
                onChange={() => setInferenceDevice('cpu')}
                className="text-primary focus:ring-primary h-4 w-4"
              />
            </label>
          </div>
        </div>

        {/* Risk Thresholds */}
        <div className="glass-panel p-6 space-y-6">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-5 h-5 text-primary" /> Risk Calculation & Alert Thresholds
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="critical-risk-threshold-slider" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Critical Risk Anomaly Threshold
                </label>
                <span className="text-sm font-bold text-primary font-mono">{riskThreshold} / 100</span>
              </div>
              <input
                id="critical-risk-threshold-slider"
                type="range"
                min="30"
                max="95"
                value={riskThreshold}
                onChange={(e) => setRiskThreshold(Number(e.target.value))}
                aria-label="Critical risk anomaly threshold percentage"
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-xs text-slate-500 mt-1">
                Any detected trajectory event with a composite risk score exceeding {riskThreshold} will immediately be escalated to High/Critical.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <label htmlFor="enable-alerts-checkbox" className="cursor-pointer select-none">
                <p className="text-sm font-medium text-slate-900">Push Notifications for Severe Drops</p>
                <p className="text-xs text-slate-500">Alert dock supervisor terminal upon high-velocity carton impacts</p>
              </label>
              <input
                id="enable-alerts-checkbox"
                type="checkbox"
                checked={enableAlerts}
                onChange={(e) => setEnableAlerts(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Submit action */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold btn-interactive flex items-center gap-2"
            title="Reset to system defaults"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            Reset to Defaults
          </button>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {savedMessage}
              </span>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-white text-sm font-semibold btn-interactive shadow-sm"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </form>
    </motion.div>
  );
};
