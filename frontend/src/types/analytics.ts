export interface AnalyticsSummary {
  totalEvents: number;
  criticalEvents: number;
  highRiskEvents: number;
  mediumRiskEvents: number;
  lowRiskEvents: number;
  preventionIndex?: number;
  activeIncidents?: number;
  resolvedIncidents?: number;
  repeatBehaviourPct?: number;
}

export interface AnalyticsSummaryResponse {
  summary: AnalyticsSummary;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  behaviours: BehaviourMetric[];
}

export interface BehaviourMetric {
  name: string;
  value: number;
  avg_score?: number;
}

export interface RiskMetric {
  risk_level: string;
  count: number;
  avg_score?: number;
}

export interface TimelinePoint {
  timestamp: number;
  event_id: string;
  behaviour: string;
  risk_score: number;
  risk_level: string;
  bay_id?: string;
}
