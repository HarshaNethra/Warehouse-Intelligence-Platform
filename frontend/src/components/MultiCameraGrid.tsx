import React from 'react';
import { Camera, Maximize2 } from 'lucide-react';

export interface CameraFeedItem {
  id: string;
  cameraId: string;
  name: string;
  bay: string;
  videoUrl: string;
  filename: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  primaryHazard: string;
  fps: number;
}

const ALL_CAMERA_FEEDS: CameraFeedItem[] = [
  {
    id: 'cam-01',
    cameraId: 'CAM-01',
    name: 'Inbound Dock 01',
    bay: 'Loading Bay 01',
    videoUrl: '/videos/Rolling%20and%20dropping%20carton.mp4',
    filename: 'Rolling and dropping carton.mp4',
    riskLevel: 'CRITICAL',
    riskScore: 94.6,
    primaryHazard: 'Carton Drop & Freefall Deceleration',
    fps: 30,
  },
  {
    id: 'cam-02',
    cameraId: 'CAM-02',
    name: 'Outbound Dock 02',
    bay: 'Loading Bay 02',
    videoUrl: '/videos/Dock%20level%2C%20dragging%20cupboard.mp4',
    filename: 'Dock level, dragging cupboard.mp4',
    riskLevel: 'HIGH',
    riskScore: 82.5,
    primaryHazard: 'Cupboard Floor Dragging & Abrasion',
    fps: 30,
  },
  {
    id: 'cam-03',
    cameraId: 'CAM-03',
    name: 'Heavy Goods Aisle 05',
    bay: 'Aisle 05',
    videoUrl: '/videos/throwing%20mattresses.mp4',
    filename: 'throwing mattresses.mp4',
    riskLevel: 'CRITICAL',
    riskScore: 92.4,
    primaryHazard: 'Throwing Mattresses & Ballistic Shock',
    fps: 30,
  },
  {
    id: 'cam-04',
    cameraId: 'CAM-04',
    name: 'QC Buffer Staging',
    bay: 'Buffer Zone',
    videoUrl: '/videos/Stepping%20on%20carton.mp4',
    filename: 'Stepping on carton.mp4',
    riskLevel: 'HIGH',
    riskScore: 68.2,
    primaryHazard: 'Stepping on Carton Top Surface',
    fps: 30,
  },
  {
    id: 'cam-05',
    cameraId: 'CAM-05',
    name: 'Conveyance Bay 03',
    bay: 'Bay 03',
    videoUrl: '/videos/sliding%20box.mp4',
    filename: 'sliding box.mp4',
    riskLevel: 'MEDIUM',
    riskScore: 54.0,
    primaryHazard: 'Sliding Box Surface Friction',
    fps: 30,
  },
  {
    id: 'cam-06',
    cameraId: 'CAM-06',
    name: 'High-Rack Storage 04',
    bay: 'Aisle 04',
    videoUrl: '/videos/Improper%20stacking.mp4',
    filename: 'Improper stacking.mp4',
    riskLevel: 'HIGH',
    riskScore: 76.8,
    primaryHazard: 'Improper Heavy Column Stacking',
    fps: 30,
  },
  {
    id: 'cam-07',
    cameraId: 'CAM-07',
    name: 'Pilot Staging Area',
    bay: 'Loading Bay 01',
    videoUrl: '/videos/sample_handling.mp4',
    filename: 'sample_handling.mp4',
    riskLevel: 'MEDIUM',
    riskScore: 48.0,
    primaryHazard: 'Pallet Position Adjustment',
    fps: 30,
  },
];

export interface MultiCameraGridProps {
  onSelectFeed: (feed: CameraFeedItem) => void;
  activeFeedFilename?: string;
}

export const MultiCameraGrid: React.FC<MultiCameraGridProps> = ({
  onSelectFeed,
  activeFeedFilename,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600" />
            Synchronized 7-Camera Live Warehouse Optical Wall
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-angle surveillance across all Godrej facility zones with automatic hazard highlighting.
          </p>
        </div>

        <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          7 Optical Streams Active
        </span>
      </div>

      {/* Grid of 7 Cameras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ALL_CAMERA_FEEDS.map((feed) => {
          const isActive = activeFeedFilename === feed.filename;
          const isCrit = feed.riskLevel === 'CRITICAL';
          const isHigh = feed.riskLevel === 'HIGH';

          return (
            <div
              key={feed.id}
              onClick={() => onSelectFeed(feed)}
              className={`group bg-white rounded-xl overflow-hidden border cursor-pointer transition-all duration-200 hover:shadow-xl relative flex flex-col justify-between ${
                isActive
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : isCrit
                  ? 'border-red-300 hover:border-red-400'
                  : isHigh
                  ? 'border-orange-300 hover:border-orange-400'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Video Player Box */}
              <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                <video
                  src={feed.videoUrl}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  autoPlay
                  muted
                  loop
                  playsInline
                />

                {/* Camera HUD Overlays */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white border border-slate-700">
                  <span className={`w-1.5 h-1.5 rounded-full ${isCrit ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                  {feed.cameraId}
                </div>

                <div
                  className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border shadow ${
                    isCrit
                      ? 'bg-red-600 text-white border-red-400'
                      : isHigh
                      ? 'bg-orange-600 text-white border-orange-400'
                      : 'bg-amber-600 text-white border-amber-400'
                  }`}
                >
                  {feed.riskScore.toFixed(0)}% Risk
                </div>

                {/* Quick inspect overlay button */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[2px]">
                  <span className="px-3 py-1 rounded-lg bg-blue-600 shadow-lg flex items-center gap-1">
                    <Maximize2 className="w-3.5 h-3.5" />
                    Focus Stream
                  </span>
                </div>
              </div>

              {/* Feed Card Footer Details */}
              <div className="p-3 bg-white border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{feed.name}</h4>
                  <span className="text-[10px] font-mono text-slate-500">{feed.fps} FPS</span>
                </div>

                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span className="text-slate-700 truncate max-w-[180px]">⚠️ {feed.primaryHazard}</span>
                  <span className="font-mono text-[10px] text-blue-600 font-semibold">{feed.bay}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
