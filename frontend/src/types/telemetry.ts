export interface FrameTelemetryPoint {
  time: number; // Timecode in seconds (0 to duration)
  frame?: number; // Frame index (Math.round(time * fps))
  frameRisk: number; // 0 to 100
  riskScore?: number; // Alias for frameRisk
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  eventType?: string | null;
  event?: string; // Optional active anomaly description
  anomaly?: boolean; // True if active anomaly
  confidence?: number; // Explicit detection confidence (0.0 to 1.0)
  dropRisk?: number; // Contribution score for drop/impact
  dragRisk?: number; // Contribution score for floor dragging
  stackRisk?: number; // Contribution score for stacking instability
  startTime?: number; // Event start interval (seconds)
  endTime?: number; // Event end interval (seconds)
  accelerationY?: number; // m/s² vertical drop acceleration
  velocityHorizontal?: number; // m/s dragging translation velocity
  bbox?: [number, number, number, number]; // [left%, top%, width%, height%]
  targetClass?: string; // e.g. "carton", "person", "pallet"
  objectId?: number; // ByteTrack object ID
  isPeak?: boolean; // True if this timestamp is a key risk event peak
}

export interface VideoTelemetryPayload {
  id: string;
  title: string;
  bay: string;
  filename: string;
  videoUrl: string;
  duration: number; // In seconds
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  riskScore: number;
  behaviors: string[];
  timelineData: FrameTelemetryPoint[];
  isCustomUpload?: boolean;
  fileSizeBytes?: number;
}

export interface ModelStatus {
  detectorName: string;
  trackerName: string;
  inferenceDevice: string;
  latencyMs: number;
  fps: number;
  map05: number;
}

export interface TemporalRiskState {
  currentTime: number;
  currentFrame: number;
  currentRisk: number;
  currentRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  currentEvent: string | null;
  currentEventType: string | null;
  isAnomaly: boolean;
  activePoint: FrameTelemetryPoint;
  peakPoint: FrameTelemetryPoint;
  peakRisk: number;
  peakTime: number;
  videoDuration: number;
}

/**
 * Single source of truth deterministic temporal mapping: Video currentTime -> Risk Data
 */
export function getRiskAtTime(
  timelineData: FrameTelemetryPoint[],
  currentTime: number,
  fps: number = 30
): TemporalRiskState {
  if (!timelineData || timelineData.length === 0) {
    const defaultPoint: FrameTelemetryPoint = {
      time: currentTime,
      frame: Math.round(currentTime * fps),
      frameRisk: 0,
      riskScore: 0,
      riskLevel: 'LOW',
      eventType: null,
      event: undefined,
      anomaly: false,
    };
    return {
      currentTime,
      currentFrame: Math.round(currentTime * fps),
      currentRisk: 0,
      currentRiskLevel: 'LOW',
      currentEvent: null,
      currentEventType: null,
      isAnomaly: false,
      activePoint: defaultPoint,
      peakPoint: defaultPoint,
      peakRisk: 0,
      peakTime: 0,
      videoDuration: 0,
    };
  }

  // 1. Single source of truth for Peak Risk & Peak Time across the whole timeline
  const peakPoint = timelineData.reduce(
    (max, p) => (p.frameRisk > max.frameRisk ? p : max),
    timelineData[0]
  );

  const duration = timelineData[timelineData.length - 1]?.time ?? 0;
  const clampedTime = Math.max(0, Math.min(currentTime, duration));

  // 2. Find surrounding points for linear interpolation
  let lower = timelineData[0];
  let upper = timelineData[timelineData.length - 1];

  for (let i = 0; i < timelineData.length; i++) {
    if (timelineData[i].time <= clampedTime) {
      lower = timelineData[i];
    }
    if (timelineData[i].time >= clampedTime) {
      upper = timelineData[i];
      break;
    }
  }

  // Linear interpolation for current risk score
  let currentRisk = lower.frameRisk;
  if (upper.time > lower.time) {
    const ratio = (clampedTime - lower.time) / (upper.time - lower.time);
    currentRisk = lower.frameRisk + ratio * (upper.frameRisk - lower.frameRisk);
  }
  currentRisk = Number(currentRisk.toFixed(1));

  // Nearest point for discrete metadata
  const closestPoint = (clampedTime - lower.time <= upper.time - clampedTime) ? lower : upper;

  // Active event lookup across temporal event interval
  const activeIntervalPoint = timelineData.find((p) => {
    if (!p.event) return false;
    const start = p.startTime ?? (p.time - 1.5);
    const end = p.endTime ?? (p.time + 1.5);
    return clampedTime >= start && clampedTime <= end;
  });

  const activeEventDescription = activeIntervalPoint?.event || closestPoint.event || null;
  const activeEventType = activeIntervalPoint?.eventType || closestPoint.eventType || null;

  const currentRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
    currentRisk >= 80 ? 'CRITICAL' : currentRisk >= 60 ? 'HIGH' : currentRisk >= 35 ? 'MEDIUM' : 'LOW';

  const isAnomaly = currentRisk >= 60 || !!activeIntervalPoint || !!closestPoint.anomaly || !!closestPoint.event;

  return {
    currentTime: clampedTime,
    currentFrame: Math.round(clampedTime * fps),
    currentRisk,
    currentRiskLevel,
    currentEvent: activeEventDescription,
    currentEventType: activeEventType,
    isAnomaly,
    activePoint: {
      ...closestPoint,
      event: activeEventDescription || closestPoint.event,
      frameRisk: currentRisk,
      riskScore: currentRisk,
      riskLevel: currentRiskLevel,
    },
    peakPoint,
    peakRisk: Number(peakPoint.frameRisk.toFixed(1)),
    peakTime: peakPoint.time,
    videoDuration: duration,
  };
}

/**
 * Dynamic Kinematic & Risk Telemetry Generator
 * Evaluates video filenames and native duration to generate frame-by-frame time-series data
 */
export function generateTelemetryForVideo(
  fileName: string, 
  fileSize?: number,
  customBay?: string,
  customVideoUrl?: string,
  actualDuration: number = 60
): VideoTelemetryPayload {
  const cleanName = fileName.toLowerCase();
  const bytes = fileSize || 15 * 1024 * 1024;
  const duration = Math.max(5, Math.ceil(actualDuration));

  const timelineData: FrameTelemetryPoint[] = [];
  let behaviors: string[] = ['Standard Warehousing Handling', 'ByteTrack Target Active'];

  const isThrowing = cleanName.includes('throwing') || cleanName.includes('mattress');
  const isDropping = cleanName.includes('dropping') || cleanName.includes('rolling');
  const isDragging = cleanName.includes('dragging') || cleanName.includes('cupboard') || cleanName.includes('wet');
  const isSteppingStacking = cleanName.includes('stepping') || cleanName.includes('stack') || cleanName.includes('heavy') || cleanName.includes('kd');

  // Peak center locations relative to video length
  const peak1Time = Math.floor(duration * 0.3);
  const peak2Time = Math.floor(duration * 0.7);

  if (isThrowing) {
    behaviors = ['Throwing Mattresses', 'High Impact Impulse', 'Strap Misuse Hazard'];
    for (let t = 0; t <= duration; t++) {
      let risk = 15 + Math.sin(t * 0.2) * 5;
      let evt: string | undefined = undefined;

      if (Math.abs(t - peak1Time) <= 4) {
        const gaussian = Math.exp(-Math.pow(t - peak1Time, 2) / 6.0);
        risk = 30 + gaussian * 64.6;
        if (t === peak1Time) {
          evt = 'Throwing Mattresses • High Impact Impulse > 14.2 m/s²';
        }
      } else if (Math.abs(t - peak2Time) <= 3) {
        const gaussian = Math.exp(-Math.pow(t - peak2Time, 2) / 4.0);
        risk = 25 + gaussian * 63.0;
        if (t === peak2Time) {
          evt = 'Strap Pulling & Carton Tossing Detected';
        }
      }
      const isPeakPoint = t === peak1Time || t === peak2Time;
      const frameRisk = Math.min(99.9, Math.max(5, Number(risk.toFixed(1))));
      timelineData.push({
        time: t,
        frame: t * 30,
        frameRisk,
        riskScore: frameRisk,
        riskLevel: frameRisk >= 80 ? 'CRITICAL' : frameRisk >= 60 ? 'HIGH' : frameRisk >= 35 ? 'MEDIUM' : 'LOW',
        event: evt,
        anomaly: frameRisk >= 60,
        accelerationY: evt ? 14.2 : 2.1,
        velocityHorizontal: 1.2,
        isPeak: isPeakPoint,
        targetClass: isPeakPoint ? 'mattress' : 'carton',
        objectId: 42,
        bbox: [35 + (t % 5) * 3, 30 + Math.sin(t) * 5, 25, 20]
      });
    }
  } else if (isSteppingStacking) {
    behaviors = ['Stepping on Cartons', 'Improper Heavy-on-Light Stacking', 'Off-Orientation Placement'];
    for (let t = 0; t <= duration; t++) {
      let risk = 20 + Math.sin(t * 0.15) * 8;
      let evt: string | undefined = undefined;

      if (Math.abs(t - peak1Time) <= 4) {
        const peak = Math.exp(-Math.pow(t - peak1Time, 2) / 6.0);
        risk = 35 + peak * 61.1;
        if (t === peak1Time) evt = 'CRITICAL: Package Stepping & Heavy Box Kept on Light Packets';
      }
      const isPeakPoint = t === peak1Time;
      const frameRisk = Math.min(99.9, Math.max(8, Number(risk.toFixed(1))));
      timelineData.push({
        time: t,
        frame: t * 30,
        frameRisk,
        riskScore: frameRisk,
        riskLevel: frameRisk >= 80 ? 'CRITICAL' : frameRisk >= 60 ? 'HIGH' : frameRisk >= 35 ? 'MEDIUM' : 'LOW',
        event: evt,
        anomaly: frameRisk >= 60,
        accelerationY: evt ? 8.4 : 1.5,
        velocityHorizontal: 0.9,
        isPeak: isPeakPoint,
        targetClass: isPeakPoint ? 'operator' : 'carton',
        objectId: 18,
        bbox: [30 + (t % 4) * 2, 25 + Math.cos(t) * 4, 30, 25]
      });
    }
  } else if (isDropping) {
    behaviors = ['Product Dropped from Height', 'Impact Acceleration Spike > 9.8m/s²'];
    for (let t = 0; t <= duration; t++) {
      let risk = 12 + Math.cos(t * 0.1) * 4;
      let evt: string | undefined = undefined;

      if (Math.abs(t - peak1Time) <= 5) {
        const peak = Math.exp(-Math.pow(t - peak1Time, 2) / 7.0);
        risk = 25 + peak * 66.2;
        if (t === peak1Time) evt = 'Product Dropped • Impact Acceleration Spike 11.5 m/s²';
      }
      const isPeakPoint = t === peak1Time;
      const frameRisk = Math.min(99.9, Math.max(5, Number(risk.toFixed(1))));
      timelineData.push({
        time: t,
        frame: t * 30,
        frameRisk,
        riskScore: frameRisk,
        riskLevel: frameRisk >= 80 ? 'CRITICAL' : frameRisk >= 60 ? 'HIGH' : frameRisk >= 35 ? 'MEDIUM' : 'LOW',
        event: evt,
        anomaly: frameRisk >= 60,
        accelerationY: evt ? 11.5 : 1.2,
        velocityHorizontal: 0.6,
        isPeak: isPeakPoint,
        targetClass: 'carton',
        objectId: 42,
        bbox: [40 + Math.sin(t) * 3, 35 + (t % 6) * 2, 22, 20]
      });
    }
  } else if (isDragging) {
    behaviors = ['Product Dragged on Floor', 'Unsafe Concrete Dragging Translation'];
    for (let t = 0; t <= duration; t++) {
      let risk = 18;
      let evt: string | undefined = undefined;

      if (t >= Math.floor(duration * 0.2) && t <= Math.floor(duration * 0.7)) {
        risk = 68 + Math.sin(t * 0.4) * 11;
        if (t === peak1Time) evt = 'Continuous Carton Dragging on Wet Floor (v > 1.4 m/s)';
      }
      const isPeakPoint = t === peak1Time;
      const frameRisk = Math.min(99.9, Math.max(10, Number(risk.toFixed(1))));
      timelineData.push({
        time: t,
        frame: t * 30,
        frameRisk,
        riskScore: frameRisk,
        riskLevel: frameRisk >= 80 ? 'CRITICAL' : frameRisk >= 60 ? 'HIGH' : frameRisk >= 35 ? 'MEDIUM' : 'LOW',
        event: evt,
        anomaly: frameRisk >= 60,
        accelerationY: 0.8,
        velocityHorizontal: evt ? 1.8 : 0.4,
        isPeak: isPeakPoint,
        targetClass: 'furniture',
        objectId: 99,
        bbox: [25 + (t % 8) * 3, 50, 35, 25]
      });
    }
  } else {
    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
      hash = (hash << 5) - hash + cleanName.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash) % 100;
    behaviors = ['Motion Anomaly Detected', 'YOLO11 Object Tracking Active'];

    for (let t = 0; t <= duration; t++) {
      const noise = Math.sin(t * 0.25 + seed) * 12;
      const spikePoint = Math.floor(duration * 0.4);
      let evt: string | undefined = undefined;
      let risk = 20 + noise;

      if (Math.abs(t - spikePoint) <= 4) {
        risk += 45 * Math.exp(-Math.pow(t - spikePoint, 2) / 3.0);
        if (t === spikePoint) evt = 'Kinematic Motion Anomaly Flagged';
      }

      const isPeakPoint = t === spikePoint;
      const frameRisk = Math.min(99.9, Math.max(5, Number(risk.toFixed(1))));
      timelineData.push({
        time: t,
        frame: t * 30,
        frameRisk,
        riskScore: frameRisk,
        riskLevel: frameRisk >= 80 ? 'CRITICAL' : frameRisk >= 60 ? 'HIGH' : frameRisk >= 35 ? 'MEDIUM' : 'LOW',
        event: evt,
        anomaly: frameRisk >= 60,
        isPeak: isPeakPoint,
        bbox: [35 + Math.sin(t) * 4, 30 + Math.cos(t) * 4, 25, 20]
      });
    }
  }

  // Derive peak risk from timeline points directly
  const peakPoint = timelineData.reduce(
    (max, p) => (p.frameRisk > max.frameRisk ? p : max),
    timelineData[0]
  );
  const compositeScore = peakPoint ? peakPoint.frameRisk : 75.0;
  const riskLevel = compositeScore >= 80 ? 'Critical' : compositeScore >= 60 ? 'High' : compositeScore >= 35 ? 'Medium' : 'Low';

  const defaultUrl = customVideoUrl || `/videos/${encodeURIComponent(fileName)}`;

  return {
    id: `VID-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: fileName.replace(/\.[^/.]+$/, ''),
    bay: customBay || 'Custom Bay Feed',
    filename: fileName,
    videoUrl: defaultUrl,
    duration,
    riskLevel,
    riskScore: compositeScore,
    behaviors,
    timelineData,
    fileSizeBytes: bytes
  };
}
