import type { RiskLevel } from './event';

export interface SourceEvent {
  event_id: string;
  behaviour: string;
  risk_level: RiskLevel | string;
  risk_score: number;
  timestamp: number;
  bay_id?: string;
  description?: string;
}

export interface ChatRequest {
  question: string;
  session_id?: string;
  camera_id?: string;
  bay_id?: string;
}

export interface ChatResponse {
  question: string;
  answer: string;
  source_events: SourceEvent[];
  model_used: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceEvent[];
  model?: string;
}
