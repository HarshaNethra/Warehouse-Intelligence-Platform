import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { 
  AnalyticsSummaryResponse, 
  BehaviourMetric, 
  RiskMetric, 
  TimelinePoint 
} from '../types/analytics';
import { mockAnalytics } from './mockData';

export async function getAnalyticsSummary(): Promise<AnalyticsSummaryResponse> {
  try {
    return await apiClient.get<AnalyticsSummaryResponse>(API_ENDPOINTS.ANALYTICS_SUMMARY);
  } catch (error) {
    console.warn('Backend API /analytics/summary unavailable, falling back to mock data:', error);
    return { summary: mockAnalytics.summary };
  }
}

export async function getBehaviourAnalytics(): Promise<BehaviourMetric[]> {
  try {
    return await apiClient.get<BehaviourMetric[]>(API_ENDPOINTS.ANALYTICS_BEHAVIOURS);
  } catch (error) {
    console.warn('Backend API /analytics/behaviours unavailable, falling back to mock data:', error);
    return mockAnalytics.behaviours;
  }
}

export async function getRiskAnalytics(): Promise<RiskMetric[]> {
  try {
    return await apiClient.get<RiskMetric[]>(API_ENDPOINTS.ANALYTICS_RISK);
  } catch (error) {
    console.warn('Backend API /analytics/risk unavailable, returning default distribution:', error);
    return [
      { risk_level: 'Critical', count: mockAnalytics.summary.criticalEvents },
      { risk_level: 'High', count: mockAnalytics.summary.highRiskEvents },
      { risk_level: 'Medium', count: mockAnalytics.summary.mediumRiskEvents },
      { risk_level: 'Low', count: mockAnalytics.summary.lowRiskEvents },
    ];
  }
}

export async function getTimelineAnalytics(): Promise<TimelinePoint[]> {
  try {
    return await apiClient.get<TimelinePoint[]>(API_ENDPOINTS.ANALYTICS_TIMELINE);
  } catch (error) {
    console.warn('Backend API /analytics/timeline unavailable:', error);
    return [];
  }
}

