import type { Event, RiskLevel } from '../types/event';
import { sanitizeUrl } from './security';

const VALID_RISK_LEVELS: Record<string, RiskLevel> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * Infer a valid RiskLevel from a numeric risk score if risk_level is missing or malformed.
 */
function inferRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

/**
 * Normalizes a raw, potentially malformed or untyped event object from the API or mock data
 * into a fully valid, safe, type-compliant Event object.
 */
export function normalizeEvent(raw: any, indexFallback: number = 0): Event {
  if (!raw || typeof raw !== 'object') {
    return {
      event_id: `EVT-FALLBACK-${indexFallback}`,
      video_id: 'VID-01',
      timestamp: 0,
      bay_id: 'Bay 1',
      camera_id: 'CAM-01',
      object_id: undefined,
      behaviour: 'Unknown Anomaly',
      risk_score: 50,
      risk_level: 'Medium',
      description: 'No event description available.',
      reason: 'Automated event detection telemetry.',
      tags: [],
      evidence_frame: undefined,
      video_reference: undefined,
      recommended_action: undefined,
      created_at: new Date().toISOString(),
    };
  }

  // 1. Safe Event ID
  const event_id = raw.event_id && typeof raw.event_id === 'string' && raw.event_id.trim()
    ? raw.event_id.trim()
    : `EVT-AUTO-${indexFallback}`;

  // 2. Safe Video ID
  const video_id = raw.video_id && typeof raw.video_id === 'string' && raw.video_id.trim()
    ? raw.video_id.trim()
    : 'VID-01';

  // 3. Safe Numeric Timestamp (seconds)
  let timestamp = Number(raw.timestamp);
  if (isNaN(timestamp) || timestamp < 0) {
    timestamp = 0;
  } else {
    timestamp = Number(timestamp.toFixed(2));
  }

  // 4. Safe Behaviour
  const behaviour = raw.behaviour && typeof raw.behaviour === 'string' && raw.behaviour.trim()
    ? raw.behaviour.trim()
    : 'Detected Anomaly';

  // 5. Safe Numeric Risk Score (0-100)
  let risk_score = Number(raw.risk_score);
  if (isNaN(risk_score)) {
    risk_score = 50;
  } else {
    risk_score = Math.max(0, Math.min(100, Math.round(risk_score)));
  }

  // 6. Safe Risk Level
  let risk_level: RiskLevel;
  if (raw.risk_level && typeof raw.risk_level === 'string') {
    const normalizedKey = raw.risk_level.trim().toLowerCase();
    risk_level = VALID_RISK_LEVELS[normalizedKey] || inferRiskLevel(risk_score);
  } else {
    risk_level = inferRiskLevel(risk_score);
  }

  // 7. Safe Description
  const description = raw.description && typeof raw.description === 'string' && raw.description.trim()
    ? raw.description.trim()
    : 'No incident description provided.';

  // 8. Safe Reason
  const reason = raw.reason && typeof raw.reason === 'string' && raw.reason.trim()
    ? raw.reason.trim()
    : 'Anomaly detected during automated video analysis.';

  // 9. Safe Tags Array
  let tags: string[] = [];
  if (Array.isArray(raw.tags)) {
    tags = raw.tags
      .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
      .map((t: string) => t.trim());
  }

  // 10. Safe Media URLs
  let evidence_frame: string | undefined = undefined;
  if (raw.evidence_frame && typeof raw.evidence_frame === 'string') {
    const sanitized = sanitizeUrl(raw.evidence_frame.trim());
    if (sanitized) {
      evidence_frame = sanitized;
    }
  }

  // 11. Safe Bay, Camera, Object ID
  const bay_id = raw.bay_id && typeof raw.bay_id === 'string' ? raw.bay_id.trim() : undefined;
  const camera_id = raw.camera_id && typeof raw.camera_id === 'string' ? raw.camera_id.trim() : undefined;
  let object_id: number | undefined = undefined;
  if (raw.object_id !== undefined && raw.object_id !== null) {
    const parsedObj = Number(raw.object_id);
    if (!isNaN(parsedObj)) {
      object_id = parsedObj;
    }
  }

  return {
    event_id,
    video_id,
    timestamp,
    camera_id,
    bay_id,
    object_id,
    behaviour,
    risk_score,
    risk_level,
    description,
    reason,
    tags,
    evidence_frame,
    facility_id: raw.facility_id ? String(raw.facility_id).trim() : undefined,
    status: raw.status ? String(raw.status).trim() : 'UNRESOLVED',
    acknowledged_by_user_id: raw.acknowledged_by_user_id ? String(raw.acknowledged_by_user_id).trim() : undefined,
    acknowledged_at: raw.acknowledged_at ? String(raw.acknowledged_at).trim() : undefined,
    video_reference: raw.video_reference ? String(raw.video_reference).trim() : undefined,
    recommended_action: raw.recommended_action ? String(raw.recommended_action).trim() : undefined,
    created_at: raw.created_at ? String(raw.created_at).trim() : undefined,
    frame_number: raw.frame_number !== undefined ? Number(raw.frame_number) : undefined,
    video_fps: raw.video_fps !== undefined ? Number(raw.video_fps) : undefined,
    timestamp_seconds: raw.timestamp_seconds !== undefined ? Number(raw.timestamp_seconds) : undefined,
    timestamp_utc: raw.timestamp_utc ? String(raw.timestamp_utc).trim() : undefined,
    evidence_clip_start: raw.evidence_clip_start !== undefined ? Number(raw.evidence_clip_start) : undefined,
    evidence_clip_end: raw.evidence_clip_end !== undefined ? Number(raw.evidence_clip_end) : undefined,
    inference_run_id: raw.inference_run_id ? String(raw.inference_run_id).trim() : undefined,
  };
}

/**
 * Normalizes an array of raw event objects. Silently discards completely broken elements
 * ensuring one bad record cannot crash the application.
 */
export function normalizeEvents(rawList: unknown): Event[] {
  if (!Array.isArray(rawList)) {
    return [];
  }

  const result: Event[] = [];
  for (let i = 0; i < rawList.length; i++) {
    try {
      result.push(normalizeEvent(rawList[i], i));
    } catch (err) {
      console.warn(`[normalizeEvents] Skipped corrupt event entry at index ${i}:`, err);
    }
  }
  return result;
}
