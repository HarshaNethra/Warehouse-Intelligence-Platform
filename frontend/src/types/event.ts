export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Event {
  event_id: string;
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
  created_at?: string;
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
