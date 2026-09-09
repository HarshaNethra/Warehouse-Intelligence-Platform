import { apiClient } from './client';

export interface Facility {
  id: string;
  organization_id?: string;
  name: string;
  location?: string;
  timezone: string;
  status: string;
}

export interface LoadingBay {
  id: string;
  facility_id: string;
  name: string;
  code: string;
  status: string;
  camera_count: number;
  active_events_count: number;
  latest_incident_behaviour?: string;
  risk_level: string;
}

export interface Camera {
  id: string;
  loading_bay_id?: string;
  name: string;
  camera_code: string;
  source_type: string;
  stream_url?: string;
  status: string;
  last_seen_at?: string;
}

export async function getFacilities(): Promise<Facility[]> {
  try {
    return await apiClient.get<Facility[]>('/facilities');
  } catch (err) {
    console.warn('Failed to fetch facilities from API:', err);
    throw err;
  }
}

export async function getLoadingBays(facilityId?: string): Promise<LoadingBay[]> {
  try {
    const params: Record<string, string> = {};
    if (facilityId) params.facility_id = facilityId;
    return await apiClient.get<LoadingBay[]>('/bays', params);
  } catch (err) {
    console.warn('Failed to fetch bays from API:', err);
    return [];
  }
}

export async function getCameras(bayId?: string): Promise<Camera[]> {
  try {
    const params: Record<string, string> = {};
    if (bayId) params.bay_id = bayId;
    return await apiClient.get<Camera[]>('/cameras', params);
  } catch (err) {
    console.warn('Failed to fetch cameras from API:', err);
    return [];
  }
}
