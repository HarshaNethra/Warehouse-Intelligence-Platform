import { apiClient } from './client';

export interface SafetyRule {
  id: string;
  facility_id: string;
  name: string;
  description?: string;
  behaviour_type: string;
  threshold_config_json?: string;
  risk_level: string;
  enabled: boolean;
}

export async function getSafetyRules(facilityId?: string): Promise<SafetyRule[]> {
  try {
    const params: Record<string, string> = {};
    if (facilityId) params.facility_id = facilityId;
    return await apiClient.get<SafetyRule[]>('/safety-rules', { params });
  } catch (err) {
    console.warn('Failed to fetch safety rules from API:', err);
    return [];
  }
}

export async function toggleSafetyRule(ruleId: string, enabled: boolean): Promise<SafetyRule> {
  return await apiClient.put<SafetyRule>(`/safety-rules/${ruleId}/toggle`, { enabled });
}
