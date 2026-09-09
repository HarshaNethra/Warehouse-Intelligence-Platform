import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { 
  AnalyticsSummaryResponse, 
  BehaviourMetric, 
  RiskMetric, 
  TimelinePoint 
} from '../types/analytics';

export async function getAnalyticsSummary(): Promise<AnalyticsSummaryResponse> {
  try {
    return await apiClient.get<AnalyticsSummaryResponse>(API_ENDPOINTS.ANALYTICS_SUMMARY);
  } catch (error) {
    console.warn('Backend API /analytics/summary error:', error);
    throw error;
  }
}

export async function getBehaviourAnalytics(): Promise<BehaviourMetric[]> {
  try {
    return await apiClient.get<BehaviourMetric[]>(API_ENDPOINTS.ANALYTICS_BEHAVIOURS);
  } catch (error) {
    console.warn('Backend API /analytics/behaviours error:', error);
    throw error;
  }
}

export async function getRiskAnalytics(): Promise<RiskMetric[]> {
  try {
    return await apiClient.get<RiskMetric[]>(API_ENDPOINTS.ANALYTICS_RISK);
  } catch (error) {
    console.warn('Backend API /analytics/risk error:', error);
    throw error;
  }
}

export async function getTimelineAnalytics(): Promise<TimelinePoint[]> {
  try {
    return await apiClient.get<TimelinePoint[]>(API_ENDPOINTS.ANALYTICS_TIMELINE);
  } catch (error) {
    console.warn('Backend API /analytics/timeline error:', error);
    throw error;
  }
}

