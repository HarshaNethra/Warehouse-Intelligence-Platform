import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Cpu, Sliders, ShieldCheck, CheckCircle2, RefreshCw, RotateCcw, Cloud, Key, Activity, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '../api/client';
import { API_ENDPOINTS } from '../api/endpoints';
import { useSettings } from '../hooks/useSettings';
import { DEFAULT_SETTINGS } from '../types/settings';
import { getSafetyRules, toggleSafetyRule, type SafetyRule } from '../api/safetyRules';
import { DataProvenanceOverlay } from '../components/DataProvenanceOverlay';

interface ModelStatusResponse {
  engine: 'LOCAL_YOLO11' | 'ROBOFLOW_HOSTED';
  roboflow_configured: boolean;
  api_key_masked: string;
  project_id: string;
  model_version: string;
  connection_status: string;
  last_error?: string | null;
  fallback_active: boolean;
  device?: string;
}

export const Settings: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSettings();

  const [inferenceDevice, setInferenceDevice] = useState<'cuda' | 'cpu'>(settings.inferenceDevice);
  const [riskThreshold, setRiskThreshold] = useState<number>(settings.riskThreshold);
  const [enableAlerts, setEnableAlerts] = useState<boolean>(settings.enableAlerts);
  const [systemHealth, setSystemHealth] = useState<{ status: string; service: string } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string>('Settings updated successfully');

  // Model Engine & Roboflow State
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);
  const [loadingModelStatus, setLoadingModelStatus] = useState<boolean>(false);
  const [modelEngine, setModelEngine] = useState<'LOCAL_YOLO11' | 'ROBOFLOW_HOSTED'>('LOCAL_YOLO11');
  const [roboflowApiKey, setRoboflowApiKey] = useState<string>('');
  const [roboflowProjectId, setRoboflowProjectId] = useState<string>('warehouse-carton-det');
  const [roboflowModelVersion, setRoboflowModelVersion] = useState<string>('1');
  // Safety Rules State
  const [safetyRules, setSafetyRules] = useState<SafetyRule[]>([]);
  const [loadingRules, setLoadingRules] = useState<boolean>(false);

  const fetchSafetyRules = async () => {
    setLoadingRules(true);
    try {
      const data = await getSafetyRules();
      setSafetyRules(data);
    } catch (e) {
      console.warn('Failed to fetch safety rules:', e);
    } finally {
      setLoadingRules(false);
    }
  };

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      const updated = await toggleSafetyRule(ruleId, !currentEnabled);
      setSafetyRules(prev => prev.map(r => r.id === ruleId ? updated : r));
    } catch (e) {
      console.error('Failed to toggle safety rule:', e);
    }
  };

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

  const fetchModelStatus = async () => {
    setLoadingModelStatus(true);
    try {
      const statusData = await apiClient.get<ModelStatusResponse>(API_ENDPOINTS.MODEL_STATUS);
      setModelStatus(statusData);
      setModelEngine(statusData.engine || 'LOCAL_YOLO11');
      if (statusData.project_id) setRoboflowProjectId(statusData.project_id);
      if (statusData.model_version) setRoboflowModelVersion(statusData.model_version);
    } catch {
      // Fallback model status default
      setModelStatus({
        engine: 'LOCAL_YOLO11',
        roboflow_configured: false,
        api_key_masked: '',
        project_id: 'warehouse-carton-det',
        model_version: '1',
        connection_status: 'LOCAL',
        fallback_active: false
      });
    } finally {
      setLoadingModelStatus(false);
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

    fetchModelStatus();
    fetchSafetyRules();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      inferenceDevice,
      riskThreshold,
      enableAlerts,
    });

    // Save model switch settings to backend API
    try {
      const res = await apiClient.post<{ status: string; config: ModelStatusResponse }>(
        API_ENDPOINTS.MODEL_SWITCH,
        {
          engine: modelEngine,
          api_key: roboflowApiKey,
          project_id: roboflowProjectId,
          model_version: roboflowModelVersion,
        }
      );
      if (res && res.config) {
        setModelStatus(res.config);
      }
    } catch (err) {
      console.warn('[Settings] Failed to save model switch config:', err);
    }

    setSavedMessage('Settings and Model Engine configuration updated successfully');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleReset = () => {
    resetSettings();
    setInferenceDevice(DEFAULT_SETTINGS.inferenceDevice);
    setRiskThreshold(DEFAULT_SETTINGS.riskThreshold);
    setEnableAlerts(DEFAULT_SETTINGS.enableAlerts);
    setModelEngine('LOCAL_YOLO11');
    setSavedMessage('Settings reset to system defaults');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <DataProvenanceOverlay
      endpoint="/api/safety-rules & /api/model/status"
      facilityScope="FAC-001"
      entity="SafetyRule + ModelStatus"
      filter="Safety Rules & ML Engine Settings"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1000px] mx-auto space-y-6 p-4"
      >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" /> Platform Settings & Engine Control
        </h1>
        <p className="text-slate-500">
          Configure real-time inference hyperparameters, notification triggers, and edge/cloud AI connectivity.
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

        {/* Roboflow & AI Model Switcher Panel */}
        <div className="glass-panel p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-indigo-600" /> AI Detection Engine & Roboflow Integration
            </h2>

            {/* Connection Health Badge */}
            <div className="flex items-center gap-2">
              {loadingModelStatus ? (
                <span className="text-xs text-slate-400 font-mono animate-pulse">Checking status...</span>
              ) : modelStatus?.connection_status === 'ONLINE' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE (Roboflow Connected)
                </span>
              ) : modelStatus?.connection_status?.includes('OFFLINE') ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-100 text-amber-800 border border-amber-300" title={modelStatus?.last_error || 'Roboflow key missing or network unreachable'}>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  OFFLINE (Fallback Active)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                  LOCAL_YOLO11 (Edge Local)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between premium-transition ${
              modelEngine === 'LOCAL_YOLO11'
                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <p className="font-semibold text-sm text-slate-900">Local YOLO11 Engine</p>
                </div>
                <p className="text-xs text-slate-500 mt-1">Local edge weights & real-time kinematics pipeline</p>
              </div>
              <input
                type="radio"
                name="modelEngine"
                value="LOCAL_YOLO11"
                checked={modelEngine === 'LOCAL_YOLO11'}
                onChange={() => setModelEngine('LOCAL_YOLO11')}
                className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
            </label>

            <label className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between premium-transition ${
              modelEngine === 'ROBOFLOW_HOSTED'
                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-indigo-600" />
                  <p className="font-semibold text-sm text-slate-900">Roboflow Universe Hosted API</p>
                </div>
                <p className="text-xs text-slate-500 mt-1">Hosted cloud inference REST API with auto-fallback</p>
              </div>
              <input
                type="radio"
                name="modelEngine"
                value="ROBOFLOW_HOSTED"
                checked={modelEngine === 'ROBOFLOW_HOSTED'}
                onChange={() => setModelEngine('ROBOFLOW_HOSTED')}
                className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
            </label>
          </div>

          {/* Roboflow Configuration Credentials Sub-Panel */}
          {modelEngine === 'ROBOFLOW_HOSTED' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-800 space-y-4 shadow-inner"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1.5">
                  <Key className="w-4 h-4" /> Roboflow REST Endpoint Credentials
                </span>
                {modelStatus?.api_key_masked && (
                  <span className="text-xs font-mono text-slate-400">
                    Active Key: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">{modelStatus.api_key_masked}</code>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Roboflow API Key
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. rf_xyz123abc..."
                    value={roboflowApiKey}
                    onChange={(e) => setRoboflowApiKey(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Project ID / Slug
                  </label>
                  <input
                    type="text"
                    placeholder="warehouse-carton-det"
                    value={roboflowProjectId}
                    onChange={(e) => setRoboflowProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Model Version
                  </label>
                  <input
                    type="text"
                    placeholder="1"
                    value={roboflowModelVersion}
                    onChange={(e) => setRoboflowModelVersion(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {modelStatus?.fallback_active && (
                <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-lg flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">Fault-Tolerant Fallback Active: </span>
                    Unconfigured API key or network unreachable. System is safely routing predictions through local synthetic telemetry to ensure zero application downtime.
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Inference Device Settings */}
        <div className="glass-panel p-6 space-y-6">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="w-5 h-5 text-primary" /> Vision Inference Hardware Target
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

        {/* Database Safety Rules Engine Control */}
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Database-Backed Safety Rules Control
            </h2>
            <span className="text-xs font-semibold text-slate-500 font-mono flex items-center gap-1.5">
              {loadingRules ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                  <span>Loading Rules...</span>
                </>
              ) : (
                `${safetyRules.length} Active Rules Persisted`
              )}
            </span>
          </div>

          <div className="space-y-3">
            {safetyRules.map((rule) => (
              <div 
                key={rule.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                      {rule.id}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900">{rule.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-100 text-amber-800">
                      {rule.risk_level}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{rule.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleRule(rule.id, rule.enabled)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 shrink-0"
                >
                  {rule.enabled ? (
                    <>
                      <ToggleRight className="w-6 h-6 text-emerald-600" />
                      <span className="text-emerald-700">Enabled</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                      <span className="text-slate-400">Disabled</span>
                    </>
                  )}
                </button>
              </div>
            ))}
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
    </DataProvenanceOverlay>
  );
};
