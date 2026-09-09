import React, { useState, useRef, useEffect } from 'react';
import { 
  Truck, 
  ArrowUpRight, 
  AlertTriangle, 
  Cpu, 
  Clock, 
  Maximize2,
  Package,
  UploadCloud,
  FileVideo,
  Plus,
  X,
  CheckCircle2,
  Radio,
  RotateCcw,
  Trash2,
  ShieldCheck,
  Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  getStoredBays, 
  assignVideoToBay, 
  clearBayFeed, 
  resetAllBaysToDefault, 
  WAREHOUSE_SCENARIOS, 
  type DockBay 
} from '../utils/bayStore';
import { formatEpochDate } from '../utils/formatters';

export const LoadingBays: React.FC = () => {
  const navigate = useNavigate();
  const [bays, setBays] = useState<DockBay[]>([]);
  const [filterRisk, setFilterRisk] = useState<string>('ALL');

  // Assign Video Modal State
  const [modalBay, setModalBay] = useState<DockBay | null>(null);
  const [selectedScenarioName, setSelectedScenarioName] = useState<string>(WAREHOUSE_SCENARIOS[0].name);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const quickFileInputRef = useRef<HTMLInputElement>(null);
  const [quickUploadBayId, setQuickUploadBayId] = useState<string | null>(null);

  // Load from persistent bayStore on mount
  useEffect(() => {
    setBays(getStoredBays());
  }, []);

  const activeFeedsCount = bays.filter((b) => b.status === 'ACTIVE_FEED' && Boolean(b.videoUrl)).length;
  const criticalCount = bays.filter((b) => b.status === 'ACTIVE_FEED' && b.riskLevel === 'Critical').length;
  const highRiskCount = bays.filter((b) => b.status === 'ACTIVE_FEED' && b.riskLevel === 'High').length;

  const filteredBays = bays.filter((bay) => {
    if (filterRisk === 'ALL') return true;
    if (filterRisk === 'UNASSIGNED') return bay.status === 'UNASSIGNED';
    if (filterRisk === 'ACTIVE') return bay.status === 'ACTIVE_FEED';
    return bay.riskLevel.toUpperCase() === filterRisk.toUpperCase();
  });

  const handleOpenAssignModal = (bay: DockBay) => {
    setModalBay(bay);
    setSelectedScenarioName(WAREHOUSE_SCENARIOS[0].name);
    setUploadedFile(null);
  };

  const handleModalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setUploadedFile({
        name: file.name,
        url: objectUrl,
      });
    }
  };

  // Direct quick-upload on bay dropzone
  const handleQuickUploadClick = (bayId: string) => {
    setQuickUploadBayId(bayId);
    if (quickFileInputRef.current) {
      quickFileInputRef.current.value = '';
      quickFileInputRef.current.click();
    }
  };

  const handleQuickFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quickUploadBayId) return;

    const objectUrl = URL.createObjectURL(file);
    const updated = assignVideoToBay(quickUploadBayId, {
      videoUrl: objectUrl,
      videoTitle: file.name,
      isCustomUpload: true,
      riskLevel: 'High',
      riskScore: 78.5,
      hazard: 'Custom Ingested CCTV Stream Under Real-Time YOLO11 Inference',
      incidentTimecode: 't=03.5s',
      incidentEvent: 'Custom Video Material Handling Telemetry',
      duration: 60,
    });
    setBays(updated);
    setQuickUploadBayId(null);
  };

  // Quick 1-click preset assignment directly on bay card
  const handleQuickAssignPreset = (bayId: string, scenario: typeof WAREHOUSE_SCENARIOS[0]) => {
    const updated = assignVideoToBay(bayId, {
      videoUrl: scenario.url,
      videoTitle: scenario.name,
      isCustomUpload: false,
      riskLevel: scenario.risk,
      riskScore: scenario.riskScore,
      hazard: scenario.hazard,
      incidentTimecode: scenario.incidentTimecode,
      incidentEvent: scenario.incidentEvent,
      duration: scenario.duration,
    });
    setBays(updated);
  };

  const handleConfirmModalAssignment = () => {
    if (!modalBay) return;
    setIsSubmitting(true);

    setTimeout(() => {
      let chosenUrl = '';
      let chosenTitle = '';
      let isCustom = false;
      let chosenRisk: DockBay['riskLevel'] = 'Medium';
      let chosenScore = 65.0;
      let chosenHazard = 'Real-time Optical Monitoring Active';
      let chosenTimecode = 't=03.0s';
      let chosenEvent = 'Kinematic Motion Detected';
      let duration = 60;

      if (uploadedFile) {
        chosenTitle = uploadedFile.name;
        chosenUrl = uploadedFile.url;
        isCustom = true;
        chosenRisk = 'High';
        chosenScore = 78.5;
        chosenHazard = 'Custom Uploaded CCTV Stream (YOLO11 Tracking Active)';
        chosenTimecode = 't=03.5s';
        chosenEvent = 'Custom Stream Analysis In Progress';
      } else {
        const found = WAREHOUSE_SCENARIOS.find((s) => s.name === selectedScenarioName);
        if (found) {
          chosenTitle = found.name;
          chosenUrl = found.url;
          chosenRisk = found.risk;
          chosenScore = found.riskScore;
          chosenHazard = found.hazard;
          chosenTimecode = found.incidentTimecode;
          chosenEvent = found.incidentEvent;
          duration = found.duration;
        }
      }

      const updated = assignVideoToBay(modalBay.id, {
        videoUrl: chosenUrl || '/videos/Rolling%20and%20dropping%20carton.mp4',
        videoTitle: chosenTitle || 'Warehouse_CCTV.mp4',
        isCustomUpload: isCustom,
        riskLevel: chosenRisk,
        riskScore: chosenScore,
        hazard: chosenHazard,
        incidentTimecode: chosenTimecode,
        incidentEvent: chosenEvent,
        duration,
      });

      setBays(updated);
      setIsSubmitting(false);
      setModalBay(null);
    }, 200);
  };

  const handleClearBay = (bayId: string) => {
    const updated = clearBayFeed(bayId);
    setBays(updated);
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all loading bays to factory default configuration?')) {
      const reset = resetAllBaysToDefault();
      setBays(reset);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1440px] mx-auto space-y-6 p-4 text-slate-900"
    >
      {/* Hidden File Input for Direct Dropzone Upload */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept="video/mp4,video/x-m4v,video/*"
        onChange={handleQuickFileSelected}
        className="hidden"
      />

      {/* Top Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-md">
              <Truck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Facility Loading Bays & Optical CCTV Command Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time per-bay video feed assignment, dynamic upload timestamps, AI kinematic incident timecodes, and dock telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Risk & Status Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {['ALL', 'ACTIVE', 'CRITICAL', 'HIGH', 'UNASSIGNED'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilterRisk(lvl)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterRisk === lvl
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleResetAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            title="Reset bays to default setup"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Setup</span>
          </button>
        </div>
      </div>

      {/* Live Operational Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Monitored Docks</span>
            <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
              {activeFeedsCount} of {bays.length} Active
            </p>
          </div>
          <Truck className="w-5 h-5 text-blue-600" />
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Optical Coverage</span>
            <p className="text-xl font-bold font-mono text-indigo-600 mt-0.5">
              {bays.length > 0 ? Math.round((activeFeedsCount / bays.length) * 100) : 0}% Complete
            </p>
          </div>
          <Package className="w-5 h-5 text-indigo-600" />
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Inference Node</span>
            <p className="text-xs font-bold font-mono text-emerald-700 mt-1">YOLO11s (18ms / 30fps)</p>
          </div>
          <Cpu className="w-5 h-5 text-emerald-600" />
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Flagged Incidents</span>
            <p className="text-xl font-bold font-mono text-red-600 mt-0.5">
              {criticalCount + highRiskCount} Active ({criticalCount} Critical)
            </p>
          </div>
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
      </div>

      {/* Grid of Dynamic Loading Bays */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBays.map((bay) => {
          const isActive = bay.status === 'ACTIVE_FEED' && Boolean(bay.videoUrl);
          const isCrit = bay.riskLevel === 'Critical';
          const isHigh = bay.riskLevel === 'High';

          // -------------------------------------------------------------
          // UNASSIGNED / EMPTY BAY: Clean Upload Dropzone ("Say Upload Like That")
          // -------------------------------------------------------------
          if (!isActive) {
            return (
              <div
                key={bay.id}
                className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-5 flex flex-col justify-between shadow-2xs hover:border-blue-400 hover:bg-blue-50/20 transition-all min-h-[420px]"
              >
                {/* Header Strip */}
                <div className="w-full flex items-center justify-between text-xs text-slate-500 font-mono border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800">{bay.name}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                    {bay.code} • UNASSIGNED
                  </span>
                </div>

                {/* Center Content: Dropzone Messaging */}
                <div className="my-auto text-center space-y-3 py-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-900">No CCTV Stream Assigned</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Upload footage or assign a warehouse camera stream to activate optical AI monitoring for this bay.
                    </p>
                  </div>

                  {/* 1-Click Warehouse Preset Quick Assign Chips */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Or Quick-Assign Camera Preset:
                    </span>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {WAREHOUSE_SCENARIOS.slice(0, 3).map((scen) => (
                        <button
                          key={scen.name}
                          type="button"
                          onClick={() => handleQuickAssignPreset(bay.id, scen)}
                          className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                          title={`Assign ${scen.name}`}
                        >
                          + {scen.name.replace('.mp4', '').split(',')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons: Direct File Upload & Modal Assignment */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleQuickUploadClick(bay.id)}
                    className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileVideo className="w-3.5 h-3.5 text-blue-600" />
                    <span>Upload MP4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal(bay)}
                    className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Stream</span>
                  </button>
                </div>
              </div>
            );
          }

          // -------------------------------------------------------------
          // ACTIVE BAY: Live Video Stream, Upload Timestamp & Incident Timecodes
          // -------------------------------------------------------------
          return (
            <div
              key={bay.id}
              className={`bg-white rounded-2xl border overflow-hidden shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between ${
                isCrit
                  ? 'border-red-300 ring-2 ring-red-500/20'
                  : isHigh
                  ? 'border-orange-300 ring-1 ring-orange-500/20'
                  : 'border-slate-200'
              }`}
            >
              {/* Real Live Video Camera Stream Viewport */}
              <div className="relative aspect-video w-full bg-slate-950 overflow-hidden group">
                <video
                  src={bay.videoUrl}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  autoPlay
                  muted
                  loop
                  playsInline
                />

                {/* Top-Left Live Camera Identifier */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono font-bold text-white border border-slate-700/80 shadow">
                  <span className={`w-1.5 h-1.5 rounded-full ${isCrit ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                  <span>{bay.code} • {bay.cameraId}</span>
                </div>

                {/* Top-Right Risk Level Pill */}
                <div
                  className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border shadow-md ${
                    isCrit
                      ? 'bg-red-600 text-white border-red-400'
                      : isHigh
                      ? 'bg-orange-600 text-white border-orange-400'
                      : 'bg-amber-600 text-white border-amber-400'
                  }`}
                >
                  {bay.riskScore.toFixed(1)}% RISK
                </div>

                {/* Bottom Stream Telemetry Strip */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 rounded bg-slate-950/80 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-slate-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-400" />
                    {bay.resolution} @ {bay.fps}fps
                  </span>
                  <span className="text-emerald-400 font-bold">{bay.latencyMs}ms latency</span>
                </div>

                {/* Hover Inspect CTA Overlay */}
                <div
                  onClick={() => navigate(`/?video=${encodeURIComponent(bay.videoTitle || '')}&bay=${encodeURIComponent(bay.code)}`)}
                  className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer flex items-center justify-center backdrop-blur-[2px]"
                >
                  <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xl flex items-center gap-1.5 transition-transform group-hover:scale-105">
                    <Maximize2 className="w-4 h-4" />
                    <span>Launch Deep Optical Analysis</span>
                  </span>
                </div>
              </div>

              {/* Dock Operational Details, Upload Timestamp & Incident Info */}
              <div className="p-4 space-y-3">
                {/* Title & Status */}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{bay.name}</h3>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800">
                      LIVE STREAM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{bay.zone}</p>
                </div>

                {/* Upload Timestamp & Video Title Badge */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Film className="w-3 h-3 text-blue-600" /> Assigned Clip:
                    </span>
                    <span className="font-semibold text-slate-900 text-[11px] truncate max-w-[170px]">
                      {bay.videoTitle || 'Warehouse_Feed.mp4'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> Ingestion Time:
                    </span>
                    <span className="text-slate-700 font-medium">
                      {bay.uploadedAt ? formatEpochDate(bay.uploadedAt) : 'Active Feed'}
                    </span>
                  </div>
                </div>

                {/* AI Detected Incident Timecode Box */}
                {bay.detectedIncident ? (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                      isCrit
                        ? 'bg-red-50 text-red-900 border-red-200'
                        : isHigh
                        ? 'bg-orange-50 text-orange-900 border-orange-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isCrit ? 'text-red-600 animate-bounce' : 'text-orange-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="px-1.5 py-0.2 rounded bg-red-200/80 text-red-900 font-bold text-[10px]">
                          {bay.detectedIncident.timecode}
                        </span>
                        <span className="font-bold text-[11px] truncate">
                          {bay.detectedIncident.event}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 line-clamp-1 mt-0.5 font-sans">
                        {bay.primaryHazard}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-medium">No critical hazards flagged in current optical window.</span>
                  </div>
                )}

                {/* Cargo Staging Capacity Bar */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span className="font-medium">Cargo Staging Capacity:</span>
                    <span className="font-mono font-bold text-slate-900">{bay.palletCount} / {bay.maxPallets} Pallets</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (bay.palletCount / bay.maxPallets) > 0.8 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, (bay.palletCount / bay.maxPallets) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons: Inspect Feed, Change Video, Clear Bay */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal(bay)}
                    className="py-2 px-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Change video stream"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                    <span>Change</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearBay(bay.id)}
                    className="py-2 px-1 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Unassign video stream"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/?video=${encodeURIComponent(bay.videoTitle || '')}&bay=${encodeURIComponent(bay.code)}`)}
                    className="py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                    title="Inspect optical feed in Live Monitoring"
                  >
                    <span>Inspect</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Video & Assign Stream to Bay Modal */}
      <AnimatePresence>
        {modalBay && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl overflow-hidden max-w-xl w-full border border-slate-200 shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Assign Video Stream to {modalBay.name}</h3>
                  <p className="text-xs text-slate-400">Choose a warehouse optical clip or upload a local CCTV recording</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalBay(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Local Upload Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Option 1: Upload Local CCTV Footage (.mp4)
                  </label>
                  <div
                    onClick={() => modalFileInputRef.current?.click()}
                    className="p-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-slate-50 hover:bg-blue-50/30 transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="video/mp4,video/x-m4v,video/*"
                      onChange={handleModalFileChange}
                      className="hidden"
                    />
                    <FileVideo className="w-8 h-8 text-blue-600" />
                    {uploadedFile ? (
                      <div className="text-xs text-slate-800 font-medium">
                        <p className="font-bold text-blue-600">{uploadedFile.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Click to choose a different file</p>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600">
                        <span className="font-bold text-blue-600">Click to browse file</span> or drag & drop MP4 clip
                        <p className="text-[11px] text-slate-400 mt-0.5">H.264 / MP4 up to 500MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preset Warehouse Catalog Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Option 2: Select from Standard Warehouse Scenarios
                  </label>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {WAREHOUSE_SCENARIOS.map((preset) => {
                      const isSelected = !uploadedFile && selectedScenarioName === preset.name;
                      return (
                        <div
                          key={preset.name}
                          onClick={() => {
                            setSelectedScenarioName(preset.name);
                            setUploadedFile(null);
                          }}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Radio className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                            <div className="truncate min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{preset.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{preset.hazard}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {preset.incidentTimecode}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                              preset.risk === 'Critical' ? 'bg-red-100 text-red-800' :
                              preset.risk === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {preset.risk}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalBay(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmModalAssignment}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Ingesting Stream...' : `Assign Stream to ${modalBay.code}`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LoadingBays;
