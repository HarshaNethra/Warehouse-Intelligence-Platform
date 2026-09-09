import React, { useState, useRef } from 'react';
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
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface DockBayDetail {
  id: string;
  name: string;
  code: string;
  zone: string;
  videoUrl?: string;
  videoTitle?: string;
  cameraId: string;
  status: 'DOCK_ACTIVE' | 'UNLOADING' | 'STAGING' | 'INSPECTION' | 'IDLE' | 'UNASSIGNED';
  truckNumber: string;
  supervisor: string;
  palletCount: number;
  maxPallets: number;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'Nominal';
  riskScore: number;
  primaryHazard: string;
  fps: number;
  resolution: string;
  latencyMs: number;
}

const INITIAL_BAYS: DockBayDetail[] = [
  {
    id: 'bay-01',
    name: 'Loading Bay 01 — Inbound Freight',
    code: 'DOCK-01',
    zone: 'North Dock Logistics Hub',
    videoUrl: '/videos/Rolling%20and%20dropping%20carton.mp4',
    videoTitle: 'Rolling and dropping carton.mp4',
    cameraId: 'CAM-01',
    status: 'UNLOADING',
    truckNumber: 'MH-04-GC-4482 (Godrej Logistics)',
    supervisor: 'Rajesh Kumar (Shift Lead)',
    palletCount: 16,
    maxPallets: 24,
    riskLevel: 'Critical',
    riskScore: 94.6,
    primaryHazard: 'Carton Drop & Freefall Deceleration (>12.4 m/s²)',
    fps: 30,
    resolution: '1920x1080',
    latencyMs: 18,
  },
  {
    id: 'bay-02',
    name: 'Loading Bay 02 — Outbound Distribution',
    code: 'DOCK-02',
    zone: 'East Dock Bay Terminal',
    videoUrl: '/videos/Dock%20level%2C%20dragging%20cupboard.mp4',
    videoTitle: 'Dock level, dragging cupboard.mp4',
    cameraId: 'CAM-02',
    status: 'DOCK_ACTIVE',
    truckNumber: 'KA-01-AK-9182 (Godrej Express)',
    supervisor: 'Suresh Patil',
    palletCount: 20,
    maxPallets: 24,
    riskLevel: 'High',
    riskScore: 82.5,
    primaryHazard: 'Cupboard Floor Dragging & Seal Abrasion',
    fps: 30,
    resolution: '1920x1080',
    latencyMs: 16,
  },
  {
    id: 'bay-03',
    name: 'Bay 03 — Inbound Conveyor Staging',
    code: 'STG-03',
    zone: 'Central Sorting & Conveyance',
    videoUrl: '/videos/sliding%20box.mp4',
    videoTitle: 'sliding box.mp4',
    cameraId: 'CAM-05',
    status: 'STAGING',
    truckNumber: 'Internal Transfer Line #4',
    supervisor: 'Amit Verma',
    palletCount: 12,
    maxPallets: 18,
    riskLevel: 'Medium',
    riskScore: 54.0,
    primaryHazard: 'Sliding Box Surface Friction',
    fps: 30,
    resolution: '1920x1080',
    latencyMs: 14,
  },
  {
    id: 'bay-04',
    name: 'Aisle 04 — High-Rack Pallet Storage',
    code: 'RACK-04',
    zone: 'Heavy Aisle Pallet Racking',
    videoUrl: '/videos/Improper%20stacking.mp4',
    videoTitle: 'Improper stacking.mp4',
    cameraId: 'CAM-06',
    status: 'DOCK_ACTIVE',
    truckNumber: 'Forklift Fleet #02 & #05',
    supervisor: 'Vikas Sharma',
    palletCount: 38,
    maxPallets: 40,
    riskLevel: 'High',
    riskScore: 76.8,
    primaryHazard: 'Improper Column Stacking & Top Load Stress',
    fps: 30,
    resolution: '1920x1080',
    latencyMs: 19,
  },
  {
    id: 'bay-05',
    name: 'Aisle 05 — Heavy Goods Staging',
    code: 'STG-05',
    zone: 'Mattress & Bulky Parcels Staging',
    videoUrl: '/videos/throwing%20mattresses.mp4',
    videoTitle: 'throwing mattresses.mp4',
    cameraId: 'CAM-04',
    status: 'UNLOADING',
    truckNumber: 'DL-01-EA-3310 (Heavy Cargo)',
    supervisor: 'Praveen Nair',
    palletCount: 8,
    maxPallets: 15,
    riskLevel: 'Critical',
    riskScore: 92.4,
    primaryHazard: 'Throwing Mattresses & Ballistic Shock',
    fps: 30,
    resolution: '1920x1080',
    latencyMs: 22,
  },
  {
    id: 'bay-06',
    name: 'QC Buffer & Returns Inspection Bay',
    code: 'QC-06',
    zone: 'Quality Check Quarantine Buffer',
    videoUrl: '/videos/Stepping%20on%20carton.mp4',
    videoTitle: 'Stepping on carton.mp4',
    cameraId: 'CAM-07',
    status: 'INSPECTION',
    truckNumber: 'Damage Claim Audit Batch #109',
    supervisor: 'Ananya Deshmukh (QC Lead)',
    palletCount: 6,
    maxPallets: 10,
    riskLevel: 'High',
    riskScore: 68.2,
    primaryHazard: 'Stepping on Carton Top Surface & Puncture',
    fps: 30,
    resolution: '1920x1080',
    latencyMs: 15,
  },
  {
    id: 'bay-07',
    name: 'Loading Bay 07 — South Yard Overflow',
    code: 'DOCK-07',
    zone: 'South Logistics Overflow Ramp',
    videoUrl: undefined,
    videoTitle: undefined,
    cameraId: 'CAM-08',
    status: 'UNASSIGNED',
    truckNumber: 'Pending Truck Assignment',
    supervisor: 'Unassigned Supervisor',
    palletCount: 0,
    maxPallets: 24,
    riskLevel: 'Nominal',
    riskScore: 0.0,
    primaryHazard: 'No Active Optical Feed (Awaiting Video / CCTV Assignment)',
    fps: 0,
    resolution: 'No Feed',
    latencyMs: 0,
  }
];

const PRESET_VIDEOS = [
  { name: 'Rolling and dropping carton.mp4', url: '/videos/Rolling%20and%20dropping%20carton.mp4', risk: 'Critical', hazard: 'Carton Drop & Freefall Deceleration' },
  { name: 'Dock level, dragging cupboard.mp4', url: '/videos/Dock%20level%2C%20dragging%20cupboard.mp4', risk: 'High', hazard: 'Cupboard Floor Dragging' },
  { name: 'Improper stacking.mp4', url: '/videos/Improper%20stacking.mp4', risk: 'High', hazard: 'Improper Column Stacking' },
  { name: 'throwing mattresses.mp4', url: '/videos/throwing%20mattresses.mp4', risk: 'Critical', hazard: 'Throwing Mattresses' },
  { name: 'Stepping on carton.mp4', url: '/videos/Stepping%20on%20carton.mp4', risk: 'High', hazard: 'Stepping on Carton Top Surface' },
  { name: 'sliding box.mp4', url: '/videos/sliding%20box.mp4', risk: 'Medium', hazard: 'Sliding Box Surface Friction' },
  { name: 'Throwing seating cartons, using strap to hold.mp4', url: '/videos/Throwing%20seating%20cartons%2C%20using%20strap%20to%20hold.mp4', risk: 'High', hazard: 'Strap Pulling & Throwing' },
];

export const LoadingBays: React.FC = () => {
  const navigate = useNavigate();
  const [bays, setBays] = useState<DockBayDetail[]>(INITIAL_BAYS);
  const [filterRisk, setFilterRisk] = useState<string>('ALL');

  // Upload/Assign Video Modal State
  const [uploadModalBay, setUploadModalBay] = useState<DockBayDetail | null>(null);
  const [selectedPresetVideo, setSelectedPresetVideo] = useState<string>(PRESET_VIDEOS[0].name);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredBays = bays.filter((bay) => {
    if (filterRisk === 'ALL') return true;
    return bay.riskLevel.toUpperCase() === filterRisk.toUpperCase();
  });

  const handleOpenUploadModal = (bay: DockBayDetail) => {
    setUploadModalBay(bay);
    setSelectedPresetVideo(PRESET_VIDEOS[0].name);
    setUploadedFileName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
    }
  };

  const handleAssignVideoToBay = () => {
    if (!uploadModalBay) return;
    setIsUploading(true);

    setTimeout(() => {
      let chosenVideoUrl = '';
      let chosenTitle = '';
      let chosenHazard = 'Real-time Optical Monitoring Active';
      let chosenRisk: DockBayDetail['riskLevel'] = 'Medium';
      let chosenScore = 65.0;

      if (uploadedFileName) {
        chosenTitle = uploadedFileName;
        chosenVideoUrl = `/videos/${encodeURIComponent(uploadedFileName)}`;
        chosenHazard = 'Custom Uploaded CCTV Stream (Under Real-Time YOLO11 Inference)';
        chosenRisk = 'High';
        chosenScore = 78.5;
      } else {
        const foundPreset = PRESET_VIDEOS.find(p => p.name === selectedPresetVideo);
        if (foundPreset) {
          chosenTitle = foundPreset.name;
          chosenVideoUrl = foundPreset.url;
          chosenHazard = foundPreset.hazard;
          chosenRisk = foundPreset.risk as DockBayDetail['riskLevel'];
          chosenScore = chosenRisk === 'Critical' ? 92.5 : chosenRisk === 'High' ? 76.0 : 50.0;
        }
      }

      setBays(prev =>
        prev.map(b =>
          b.id === uploadModalBay.id
            ? {
                ...b,
                videoUrl: chosenVideoUrl || '/videos/Rolling%20and%20dropping%20carton.mp4',
                videoTitle: chosenTitle || 'Warehouse_CCTV.mp4',
                status: 'DOCK_ACTIVE',
                primaryHazard: chosenHazard,
                riskLevel: chosenRisk,
                riskScore: chosenScore,
                fps: 30,
                resolution: '1920x1080',
                latencyMs: 16,
                palletCount: b.palletCount === 0 ? 14 : b.palletCount
              }
            : b
        )
      );

      setIsUploading(false);
      setUploadModalBay(null);
    }, 400);
  };

  const activeFeedsCount = bays.filter(b => b.videoUrl != null).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-[1440px] mx-auto space-y-6 p-4 text-slate-900"
    >
      {/* Top Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-md">
              <Truck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Facility Loading Bays & Dock CCTV Command Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time optical video surveillance, per-bay video feed assignment, dock leveler status, and AI kinematic risk telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Risk Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((lvl) => (
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

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {activeFeedsCount} of {bays.length} Bays Active • 100% Optical Health
          </span>
        </div>
      </div>

      {/* Live Operational Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Monitored Docks</span>
            <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{activeFeedsCount} Active Bays</p>
          </div>
          <Truck className="w-5 h-5 text-blue-600" />
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Shifts Cargo</span>
            <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">100 / 160 Pallets</p>
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
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Critical Incidents</span>
            <p className="text-xl font-bold font-mono text-red-600 mt-0.5">2 Flagged</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
      </div>

      {/* Real Live CCTV Dock Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBays.map((bay) => {
          const hasVideo = Boolean(bay.videoUrl);
          const isCrit = bay.riskLevel === 'Critical';
          const isHigh = bay.riskLevel === 'High';

          if (!hasVideo) {
            // Unassigned / Idle Bay Dropzone Card
            return (
              <div
                key={bay.id}
                className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-6 flex flex-col items-center justify-between text-center shadow-2xs hover:border-blue-400 hover:bg-blue-50/20 transition-all min-h-[380px]"
              >
                <div className="w-full flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-700">{bay.name}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-bold">UNASSIGNED</span>
                </div>

                <div className="my-auto space-y-3 py-6">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">No CCTV Stream Assigned</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Upload footage or assign a warehouse camera stream to activate optical AI monitoring for this bay.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenUploadModal(bay)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Video / Assign Stream to {bay.code}</span>
                </button>
              </div>
            );
          }

          // Active Bay Card with Live Video Stream
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
                  onClick={() => navigate(`/?video=${encodeURIComponent(bay.videoTitle || '')}`)}
                  className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer flex items-center justify-center backdrop-blur-[2px]"
                >
                  <span className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xl flex items-center gap-1.5 transition-transform group-hover:scale-105">
                    <Maximize2 className="w-4 h-4" />
                    <span>Launch Deep Optical Analysis</span>
                  </span>
                </div>
              </div>

              {/* Dock Operational Details & Active Manifest */}
              <div className="p-4 space-y-3.5">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{bay.name}</h3>
                    <span
                      className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase ${
                        bay.status === 'UNLOADING'
                          ? 'bg-blue-100 text-blue-800'
                          : bay.status === 'DOCK_ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {bay.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{bay.zone}</p>
                </div>

                {/* Manifest & Vehicle Details */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Transport</span>
                    <p className="font-semibold text-slate-800 text-[11px] truncate mt-0.5">{bay.truckNumber}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Shift Supervisor</span>
                    <p className="font-semibold text-slate-800 text-[11px] truncate mt-0.5">{bay.supervisor}</p>
                  </div>
                </div>

                {/* Pallet Load Progress Bar */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span className="font-medium">Cargo Staging Capacity:</span>
                    <span className="font-mono font-bold text-slate-900">{bay.palletCount} / {bay.maxPallets} Pallets</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (bay.palletCount / bay.maxPallets) > 0.8 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${(bay.palletCount / bay.maxPallets) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Active Hazard Warning Banner */}
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    isCrit
                      ? 'bg-red-50 text-red-900 border-red-200'
                      : isHigh
                      ? 'bg-orange-50 text-orange-900 border-orange-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${
                      isCrit ? 'text-red-600 animate-bounce' : 'text-orange-600'
                    }`}
                  />
                  <span className="font-medium text-[11px] truncate">
                    {bay.primaryHazard}
                  </span>
                </div>

                {/* Action Buttons: Inspect Feed + Change Video */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenUploadModal(bay)}
                    className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                    <span>Change Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/?video=${encodeURIComponent(bay.videoTitle || '')}`)}
                    className="py-2 px-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Inspect Feed</span>
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
        {uploadModalBay && (
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
                  <h3 className="text-base font-bold">Assign Video Stream to {uploadModalBay.name}</h3>
                  <p className="text-xs text-slate-400">Choose a warehouse optical clip or upload a local CCTV recording</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadModalBay(null)}
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
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-slate-50 hover:bg-blue-50/30 transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/x-m4v,video/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <FileVideo className="w-8 h-8 text-blue-600" />
                    {uploadedFileName ? (
                      <div className="text-xs text-slate-800 font-medium">
                        <p className="font-bold text-blue-600">{uploadedFileName}</p>
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
                    Option 2: Select from Warehouse Camera Feeds
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {PRESET_VIDEOS.map((preset) => {
                      const isSelected = !uploadedFileName && selectedPresetVideo === preset.name;
                      return (
                        <div
                          key={preset.name}
                          onClick={() => {
                            setSelectedPresetVideo(preset.name);
                            setUploadedFileName('');
                          }}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Radio className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                            <div className="truncate min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{preset.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{preset.hazard}</p>
                            </div>
                          </div>

                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                            preset.risk === 'Critical' ? 'bg-red-100 text-red-800' :
                            preset.risk === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {preset.risk}
                          </span>
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
                  onClick={() => setUploadModalBay(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignVideoToBay}
                  disabled={isUploading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isUploading ? 'Ingesting Stream...' : `Assign Stream to ${uploadModalBay.code}`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

