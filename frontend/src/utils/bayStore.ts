export interface DockBay {
  id: string;
  name: string;
  code: string;
  zone: string;
  status: 'ACTIVE_FEED' | 'UNASSIGNED';
  videoUrl?: string;
  videoTitle?: string;
  isCustomUpload?: boolean;
  uploadedAt?: string;
  durationSeconds?: number;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'Nominal';
  riskScore: number;
  primaryHazard: string;
  detectedIncident?: {
    timecode: string;
    event: string;
    risk: number;
  };
  cameraId: string;
  fps: number;
  resolution: string;
  latencyMs: number;
  palletCount: number;
  maxPallets: number;
}

export const WAREHOUSE_SCENARIOS = [
  {
    name: 'Rolling and dropping carton.mp4',
    url: '/videos/Rolling%20and%20dropping%20carton.mp4',
    risk: 'Critical' as const,
    riskScore: 94.6,
    hazard: 'Carton Drop & Freefall Deceleration (>12.4 m/s²)',
    incidentTimecode: 't=03.2s',
    incidentEvent: 'Vertical Freefall Drop Anomaly',
    duration: 60,
  },
  {
    name: 'Dock level, dragging cupboard.mp4',
    url: '/videos/Dock%20level%2C%20dragging%20cupboard.mp4',
    risk: 'High' as const,
    riskScore: 82.5,
    hazard: 'Cupboard Floor Dragging & Seal Abrasion',
    incidentTimecode: 't=07.5s',
    incidentEvent: 'Heavy Floor Friction Dragging',
    duration: 45,
  },
  {
    name: 'Improper stacking.mp4',
    url: '/videos/Improper%20stacking.mp4',
    risk: 'High' as const,
    riskScore: 78.4,
    hazard: 'Heavy Goods Inverted Stacking Hierarchy',
    incidentTimecode: 't=12.1s',
    incidentEvent: 'Over-capacity Heavy Column Load',
    duration: 48,
  },
  {
    name: 'throwing mattresses.mp4',
    url: '/videos/throwing%20mattresses.mp4',
    risk: 'Critical' as const,
    riskScore: 92.4,
    hazard: 'Throwing Mattresses & Ballistic Shock',
    incidentTimecode: 't=04.8s',
    incidentEvent: 'Ballistic Toss & Airborne Trajectory',
    duration: 40,
  },
  {
    name: 'Stepping on carton.mp4',
    url: '/videos/Stepping%20on%20carton.mp4',
    risk: 'Critical' as const,
    riskScore: 89.2,
    hazard: 'Direct Downward Concentrated Load on Carton',
    incidentTimecode: 't=05.6s',
    incidentEvent: 'Foot-Stepping on Top Packaging Surface',
    duration: 35,
  },
  {
    name: 'sliding box.mp4',
    url: '/videos/sliding%20box.mp4',
    risk: 'Medium' as const,
    riskScore: 54.0,
    hazard: 'Sliding Box Surface Friction',
    incidentTimecode: 't=08.3s',
    incidentEvent: 'Horizontal Conveyor Sliding Drag',
    duration: 50,
  },
  {
    name: 'Throwing seating cartons, using strap to hold.mp4',
    url: '/videos/Throwing%20seating%20cartons%2C%20using%20strap%20to%20hold.mp4',
    risk: 'High' as const,
    riskScore: 76.0,
    hazard: 'Lifting by Plastic Straps & Dynamic Pull',
    incidentTimecode: 't=06.2s',
    incidentEvent: 'Strap Snapping & Operator Pull Violation',
    duration: 42,
  },
];

const DEFAULT_BAYS: DockBay[] = [
  {
    id: 'bay-01',
    name: 'Loading Bay 01 — Inbound Freight',
    code: 'DOCK-01',
    zone: 'North Dock Logistics Hub',
    status: 'ACTIVE_FEED',
    videoUrl: '/videos/Rolling%20and%20dropping%20carton.mp4',
    videoTitle: 'Rolling and dropping carton.mp4',
    isCustomUpload: false,
    uploadedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    durationSeconds: 60,
    riskLevel: 'Critical',
    riskScore: 94.6,
    primaryHazard: 'Carton Drop & Freefall Deceleration (>12.4 m/s²)',
    detectedIncident: {
      timecode: 't=03.2s',
      event: 'Vertical Freefall Drop Anomaly',
      risk: 94.6,
    },
    cameraId: 'CAM-01',
    fps: 30,
    resolution: '1920x1080',
    latencyMs: 18,
    palletCount: 16,
    maxPallets: 24,
  },
  {
    id: 'bay-02',
    name: 'Loading Bay 02 — Outbound Distribution',
    code: 'DOCK-02',
    zone: 'East Dock Bay Terminal',
    status: 'UNASSIGNED',
    riskLevel: 'Nominal',
    riskScore: 0.0,
    primaryHazard: 'No Active Optical Feed (Awaiting Video / CCTV Assignment)',
    cameraId: 'CAM-02',
    fps: 0,
    resolution: 'No Feed',
    latencyMs: 0,
    palletCount: 0,
    maxPallets: 24,
  },
  {
    id: 'bay-03',
    name: 'Loading Bay 03 — Inbound Conveyor Staging',
    code: 'DOCK-03',
    zone: 'Central Sorting & Conveyance',
    status: 'UNASSIGNED',
    riskLevel: 'Nominal',
    riskScore: 0.0,
    primaryHazard: 'No Active Optical Feed (Awaiting Video / CCTV Assignment)',
    cameraId: 'CAM-03',
    fps: 0,
    resolution: 'No Feed',
    latencyMs: 0,
    palletCount: 0,
    maxPallets: 18,
  },
  {
    id: 'bay-04',
    name: 'Loading Bay 04 — High-Rack Pallet Staging',
    code: 'DOCK-04',
    zone: 'Heavy Aisle Pallet Racking',
    status: 'UNASSIGNED',
    riskLevel: 'Nominal',
    riskScore: 0.0,
    primaryHazard: 'No Active Optical Feed (Awaiting Video / CCTV Assignment)',
    cameraId: 'CAM-04',
    fps: 0,
    resolution: 'No Feed',
    latencyMs: 0,
    palletCount: 0,
    maxPallets: 30,
  },
  {
    id: 'bay-05',
    name: 'Loading Bay 05 — Heavy Goods Staging Ramp',
    code: 'DOCK-05',
    zone: 'Bulky Cargo Receiving Bay',
    status: 'UNASSIGNED',
    riskLevel: 'Nominal',
    riskScore: 0.0,
    primaryHazard: 'No Active Optical Feed (Awaiting Video / CCTV Assignment)',
    cameraId: 'CAM-05',
    fps: 0,
    resolution: 'No Feed',
    latencyMs: 0,
    palletCount: 0,
    maxPallets: 20,
  },
  {
    id: 'bay-06',
    name: 'Loading Bay 06 — QC Buffer & Return Audit',
    code: 'DOCK-06',
    zone: 'Quality Check Quarantine Buffer',
    status: 'UNASSIGNED',
    riskLevel: 'Nominal',
    riskScore: 0.0,
    primaryHazard: 'No Active Optical Feed (Awaiting Video / CCTV Assignment)',
    cameraId: 'CAM-06',
    fps: 0,
    resolution: 'No Feed',
    latencyMs: 0,
    palletCount: 0,
    maxPallets: 16,
  },
];

const STORAGE_KEY = 'warehouse_loading_bays_v2';

export function getStoredBays(): DockBay[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load loading bays from storage:', e);
  }
  return DEFAULT_BAYS;
}

export function saveStoredBays(bays: DockBay[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bays));
  } catch (e) {
    console.warn('Failed to save loading bays to storage:', e);
  }
}

export function assignVideoToBay(
  bayId: string,
  params: {
    videoUrl: string;
    videoTitle: string;
    isCustomUpload?: boolean;
    riskLevel?: DockBay['riskLevel'];
    riskScore?: number;
    hazard?: string;
    incidentTimecode?: string;
    incidentEvent?: string;
    duration?: number;
  }
): DockBay[] {
  const current = getStoredBays();
  const updated = current.map((bay) => {
    if (bay.id !== bayId) return bay;

    const risk = params.riskLevel || 'High';
    const score = params.riskScore ?? (risk === 'Critical' ? 92.0 : risk === 'High' ? 78.5 : 52.0);
    const hazard = params.hazard || (params.isCustomUpload ? 'Custom Ingested Feed Under YOLO11 Inference' : 'Dynamic Kinematic Anomaly Detection');

    return {
      ...bay,
      status: 'ACTIVE_FEED' as const,
      videoUrl: params.videoUrl,
      videoTitle: params.videoTitle,
      isCustomUpload: Boolean(params.isCustomUpload),
      uploadedAt: new Date().toISOString(),
      durationSeconds: params.duration || 60,
      riskLevel: risk,
      riskScore: score,
      primaryHazard: hazard,
      detectedIncident: {
        timecode: params.incidentTimecode || 't=03.2s',
        event: params.incidentEvent || hazard,
        risk: score,
      },
      fps: 30,
      resolution: '1920x1080',
      latencyMs: Math.floor(Math.random() * 8) + 14,
      palletCount: bay.palletCount === 0 ? 14 : bay.palletCount,
    };
  });

  saveStoredBays(updated);
  return updated;
}

export function clearBayFeed(bayId: string): DockBay[] {
  const current = getStoredBays();
  const updated = current.map((bay) => {
    if (bay.id !== bayId) return bay;
    return {
      ...bay,
      status: 'UNASSIGNED' as const,
      videoUrl: undefined,
      videoTitle: undefined,
      isCustomUpload: false,
      uploadedAt: undefined,
      durationSeconds: undefined,
      riskLevel: 'Nominal' as const,
      riskScore: 0.0,
      primaryHazard: 'No Active Optical Feed (Awaiting Video / CCTV Assignment)',
      detectedIncident: undefined,
      fps: 0,
      resolution: 'No Feed',
      latencyMs: 0,
      palletCount: 0,
    };
  });

  saveStoredBays(updated);
  return updated;
}

export function resetAllBaysToDefault(): DockBay[] {
  saveStoredBays(DEFAULT_BAYS);
  return DEFAULT_BAYS;
}
