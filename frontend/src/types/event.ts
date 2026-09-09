export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type IncidentStatus = 'UNRESOLVED' | 'ACKNOWLEDGED' | 'DISPATCHED';

export type ProvenanceType = 'REAL_INFERENCE' | 'DEVELOPMENT_SEED' | 'DEMO_FIXTURE' | 'PERFORMANCE_TEST' | 'UNIT_TEST';

export interface Event {
  event_id: string;
  facility_id?: string;
  video_id: string;
  timestamp: number; // in seconds
  camera_id?: string;
  bay_id?: string;
  object_id?: number;
  behaviour: string;
  risk_score: number;
  risk_level: RiskLevel;
  description: string;
  reason: string;
  tags?: string[];
  evidence_frame?: string;
  video_reference?: string;
  recommended_action?: string;
  status?: IncidentStatus | string;
  acknowledged_by_user_id?: string;
  acknowledged_at?: string;
  model_name?: string;
  model_version?: string;
  inference_engine?: string;
  confidence?: number;
  rule_version?: string;
  provenance_type?: ProvenanceType | string;
  inference_run_id?: string;
  frame_number?: number;
  video_fps?: number;
  timestamp_seconds?: number;
  timestamp_utc?: string;
  evidence_clip_start?: number;
  evidence_clip_end?: number;
  processing_latency_ms?: number;
  created_at?: string;
}

export interface InferenceRun {
  id: string;
  video_id?: string;
  camera_id?: string;
  model_name: string;
  model_version: string;
  inference_engine: string;
  device?: string;
  status?: string;
  started_at?: string;
  completed_at?: string;
  provenance_type?: ProvenanceType | string;
}

export interface EventFilterParams {
  risk_level?: RiskLevel | string;
  behaviour?: string;
  bay_id?: string;
  camera_id?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

export interface VideoMetadata {
  video_id: string;
  filename?: string;
  frame_count: number;
  fps: number;
  width: number;
  height: number;
  duration: number; // in seconds
  status?: string;
  created_at?: string;
}
