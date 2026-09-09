import React, { useState } from 'react';
import { Truck, Eye, Users, Cpu, Layers, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface WarehouseZone {
  id: string;
  name: string;
  code: string;
  type: 'DOCK' | 'AISLE' | 'STAGING' | 'STORAGE' | 'QC';
  x: number; // SVG Grid coordinates %
  y: number;
  width: number;
  height: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  activeHazards: string[];
  activeWorkers: number;
  forkliftsActive: number;
  cameraIds: string[];
  primaryVideoUrl: string;
  videoTitle: string;
}

const WAREHOUSE_ZONES: WarehouseZone[] = [
  {
    id: 'bay-01',
    name: 'Loading Bay 01 (Inbound)',
    code: 'BAY-01',
    type: 'DOCK',
    x: 4,
    y: 6,
    width: 28,
    height: 38,
    riskLevel: 'CRITICAL',
    riskScore: 94.6,
    activeHazards: ['Carton Drop & Freefall Impact', 'Tossing Hazard'],
    activeWorkers: 4,
    forkliftsActive: 1,
    cameraIds: ['CAM-01', 'CAM-02'],
    primaryVideoUrl: '/videos/Rolling%20and%20dropping%20carton.mp4',
    videoTitle: 'Rolling and dropping carton.mp4',
  },
  {
    id: 'bay-02',
    name: 'Loading Bay 02 (Outbound)',
    code: 'BAY-02',
    type: 'DOCK',
    x: 4,
    y: 52,
    width: 28,
    height: 42,
    riskLevel: 'HIGH',
    riskScore: 82.5,
    activeHazards: ['Floor Surface Abrasion', 'Heavy Dragging'],
    activeWorkers: 3,
    forkliftsActive: 2,
    cameraIds: ['CAM-03'],
    primaryVideoUrl: '/videos/Dock%20level%2C%20dragging%20cupboard.mp4',
    videoTitle: 'Dock level, dragging cupboard.mp4',
  },
  {
    id: 'bay-03',
    name: 'Bay 03 - Conveyance Staging',
    code: 'BAY-03',
    type: 'STAGING',
    x: 36,
    y: 6,
    width: 26,
    height: 38,
    riskLevel: 'MEDIUM',
    riskScore: 54.0,
    activeHazards: ['Sliding Box Friction'],
    activeWorkers: 2,
    forkliftsActive: 0,
    cameraIds: ['CAM-05'],
    primaryVideoUrl: '/videos/sliding%20box.mp4',
    videoTitle: 'sliding box.mp4',
  },
  {
    id: 'aisle-04',
    name: 'Aisle 04 - High-Rack Storage',
    code: 'AISLE-04',
    type: 'STORAGE',
    x: 66,
    y: 6,
    width: 30,
    height: 42,
    riskLevel: 'HIGH',
    riskScore: 76.8,
    activeHazards: ['Improper Heavy Stacking', 'Top Load Stress'],
    activeWorkers: 3,
    forkliftsActive: 2,
    cameraIds: ['CAM-06'],
    primaryVideoUrl: '/videos/Improper%20stacking.mp4',
    videoTitle: 'Improper stacking.mp4',
  },
  {
    id: 'aisle-05',
    name: 'Aisle 05 - Heavy Goods Staging',
    code: 'AISLE-05',
    type: 'STAGING',
    x: 36,
    y: 52,
    width: 26,
    height: 42,
    riskLevel: 'CRITICAL',
    riskScore: 92.4,
    activeHazards: ['Throwing Mattresses', 'High Impulse Shock'],
    activeWorkers: 5,
    forkliftsActive: 1,
    cameraIds: ['CAM-04'],
    primaryVideoUrl: '/videos/throwing%20mattresses.mp4',
    videoTitle: 'throwing mattresses.mp4',
  },
  {
    id: 'qc-buffer',
    name: 'QC Inspection & Buffer Zone',
    code: 'QC-ZONE',
    type: 'QC',
    x: 66,
    y: 56,
    width: 30,
    height: 38,
    riskLevel: 'HIGH',
    riskScore: 68.2,
    activeHazards: ['Stepping on Carton', 'Puncture Risk'],
    activeWorkers: 2,
    forkliftsActive: 0,
    cameraIds: ['CAM-07'],
    primaryVideoUrl: '/videos/Stepping%20on%20carton.mp4',
    videoTitle: 'Stepping on carton.mp4',
  },
];

export interface WarehouseFloorMapProps {
  onSelectZone?: (zone: WarehouseZone) => void;
  selectedZoneId?: string;
}

export const WarehouseFloorMap: React.FC<WarehouseFloorMapProps> = ({
  onSelectZone,
  selectedZoneId = 'bay-01',
}) => {
  const navigate = useNavigate();
  const [activeZoneId, setActiveZoneId] = useState<string>(selectedZoneId);

  const activeZone = WAREHOUSE_ZONES.find((z) => z.id === activeZoneId) || WAREHOUSE_ZONES[0];

  const handleZoneClick = (zone: WarehouseZone) => {
    setActiveZoneId(zone.id);
    if (onSelectZone) {
      onSelectZone(zone);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return { border: '#ef4444', fill: 'rgba(239, 68, 68, 0.18)', badge: 'bg-red-500 text-white' };
      case 'HIGH':
        return { border: '#f97316', fill: 'rgba(249, 115, 22, 0.16)', badge: 'bg-orange-500 text-white' };
      case 'MEDIUM':
        return { border: '#f59e0b', fill: 'rgba(245, 158, 11, 0.14)', badge: 'bg-amber-500 text-white' };
      default:
        return { border: '#10b981', fill: 'rgba(16, 185, 129, 0.12)', badge: 'bg-emerald-500 text-white' };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-white space-y-5">
      {/* Map Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-white tracking-tight">
              Godrej Digital Twin Floor Plan & Multi-Zone Telemetry
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any zone to inspect real-time optical tracking, kinematic velocity vectors, and active hazards.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-emerald-400 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            6 Zones Monitored
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-blue-400 border border-slate-700">
            <Cpu className="w-3.5 h-3.5" />
            YOLO11s + ByteTrack Active
          </span>
        </div>
      </div>

      {/* Main Floor Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SVG Interactive Floor Plan Canvas */}
        <div className="lg:col-span-8 bg-slate-950 rounded-xl p-4 border border-slate-800/90 relative overflow-hidden flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full aspect-[4/3] select-none">
            {/* Grid Lines */}
            <defs>
              <pattern id="floor-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#floor-grid)" />

            {/* Forklift Lane & Main Corridor Marker */}
            <line x1="33" y1="0" x2="33" y2="100" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 2" />
            <line x1="63" y1="0" x2="63" y2="100" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 2" />
            <line x1="0" y1="48" x2="100" y2="48" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 2" />

            <text x="34" y="50" fill="#64748b" fontSize="2.2" fontFamily="monospace" fontWeight="bold">
              CENTRAL FORKLIFT CORRIDOR
            </text>

            {/* Warehouse Zones */}
            {WAREHOUSE_ZONES.map((zone) => {
              const isSelected = activeZoneId === zone.id;
              const { border, fill } = getRiskColor(zone.riskLevel);

              return (
                <g
                  key={zone.id}
                  onClick={() => handleZoneClick(zone)}
                  className="cursor-pointer transition-all duration-200 group"
                >
                  {/* Outer Radar Glow on Selected / Critical */}
                  {(isSelected || zone.riskLevel === 'CRITICAL') && (
                    <rect
                      x={zone.x - 1}
                      y={zone.y - 1}
                      width={zone.width + 2}
                      height={zone.height + 2}
                      fill="none"
                      stroke={border}
                      strokeWidth="0.8"
                      rx="3"
                      strokeOpacity="0.6"
                      className="animate-pulse"
                    />
                  )}

                  {/* Zone Base Container */}
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    fill={fill}
                    stroke={isSelected ? '#38bdf8' : border}
                    strokeWidth={isSelected ? '1.5' : '0.8'}
                    rx="2"
                  />

                  {/* Zone Code Badge */}
                  <rect
                    x={zone.x + 1.5}
                    y={zone.y + 2}
                    width="11"
                    height="4.5"
                    fill="#0f172a"
                    stroke={border}
                    strokeWidth="0.4"
                    rx="1"
                  />
                  <text
                    x={zone.x + 2.5}
                    y={zone.y + 5.2}
                    fill="#f8fafc"
                    fontSize="2.4"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {zone.code}
                  </text>

                  {/* Risk Score Pill */}
                  <text
                    x={zone.x + zone.width - 2}
                    y={zone.y + 5.2}
                    textAnchor="end"
                    fill={border}
                    fontSize="2.2"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {zone.riskScore.toFixed(0)}%
                  </text>

                  {/* Zone Title */}
                  <text
                    x={zone.x + 2}
                    y={zone.y + 12}
                    fill="#e2e8f0"
                    fontSize="2.3"
                    fontWeight="600"
                  >
                    {zone.name.split('(')[0].slice(0, 16)}
                  </text>

                  {/* Hazard Snippet */}
                  <text
                    x={zone.x + 2}
                    y={zone.y + 17}
                    fill="#94a3b8"
                    fontSize="1.8"
                  >
                    ⚠️ {zone.activeHazards[0]?.slice(0, 18)}
                  </text>

                  {/* Occupancy Footprint */}
                  <text
                    x={zone.x + 2}
                    y={zone.y + zone.height - 3}
                    fill="#64748b"
                    fontSize="1.8"
                    fontFamily="monospace"
                  >
                    👤 {zone.activeWorkers} • 🚜 {zone.forkliftsActive} • 📹 {zone.cameraIds.join(', ')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Zone Live Telemetry Drawer */}
        <div className="lg:col-span-4 bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {activeZone.code}
                </span>
                <h4 className="text-base font-bold text-white mt-1">{activeZone.name}</h4>
              </div>
              <span
                className={`text-xs font-bold font-mono px-2.5 py-1 rounded-full uppercase border ${
                  activeZone.riskLevel === 'CRITICAL'
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : activeZone.riskLevel === 'HIGH'
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}
              >
                {activeZone.riskLevel} ({activeZone.riskScore.toFixed(1)}%)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 my-3.5 text-xs">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" /> Active Workers
                </span>
                <p className="text-base font-bold text-white mt-0.5 font-mono">{activeZone.activeWorkers} Personnel</p>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-amber-400" /> Material Handling
                </span>
                <p className="text-base font-bold text-white mt-0.5 font-mono">{activeZone.forkliftsActive} Forklifts</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Flagged Kinematic Hazards
              </span>
              {activeZone.activeHazards.map((h, i) => (
                <div
                  key={i}
                  className="p-2 rounded bg-red-950/40 border border-red-800/40 text-red-200 text-xs flex items-center gap-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="font-medium">{h}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Associated Optical Feeds:</span>
                <span className="font-mono text-slate-200 font-bold">{activeZone.cameraIds.join(', ')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Linked Video Stream:</span>
                <span className="font-mono text-blue-400 truncate max-w-[170px]">{activeZone.videoTitle}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              navigate(`/?video=${encodeURIComponent(activeZone.videoTitle)}`);
            }}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            <span>Launch Live Optical Analysis</span>
          </button>
        </div>
      </div>
    </div>
  );
};
