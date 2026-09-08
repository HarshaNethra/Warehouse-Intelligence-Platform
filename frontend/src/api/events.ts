import { apiClient, type RequestOptions } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { Event, EventFilterParams } from '../types/event';
import { normalizeEvent, normalizeEvents } from '../lib/normalizeEvent';

export async function getEvents(params?: EventFilterParams, options?: RequestOptions): Promise<Event[]> {
  try {
    const rawEvents = await apiClient.get<Event[]>(API_ENDPOINTS.EVENTS, params, options);
    return normalizeEvents(rawEvents);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.warn('Backend API /events error:', error);
    throw error;
  }
}

export async function getEventById(eventId: string, options?: RequestOptions): Promise<Event> {
  try {
    const raw = await apiClient.get<Event>(API_ENDPOINTS.EVENT_BY_ID(eventId), undefined, options);
    return normalizeEvent(raw);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.warn(`Backend API /events/${eventId} error:`, error);
    throw error;
  }
}

export async function exportEventsCsv(params?: EventFilterParams, options?: RequestOptions): Promise<Blob> {
  try {
    // Request CSV directly from backend export endpoint
    return await apiClient.getBlob(API_ENDPOINTS.EVENTS_EXPORT_CSV, params, options);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.warn('Backend API /events/export/csv unavailable, falling back to client-side CSV export:', error);
    const events = await getEvents(params, options);
    const headers = [
      'Event ID',
      'Video ID',
      'Timestamp (s)',
      'Bay ID',
      'Camera ID',
      'Behaviour',
      'Risk Level',
      'Risk Score',
      'Description',
      'Reason',
      'Recommended Action',
      'Created At'
    ];
    const csvRows = [headers.join(',')];

    for (const e of events) {
      const row = [
        `"${(e.event_id || '').replace(/"/g, '""')}"`,
        `"${(e.video_id || '').replace(/"/g, '""')}"`,
        e.timestamp ?? '',
        `"${(e.bay_id || 'Unassigned').replace(/"/g, '""')}"`,
        `"${(e.camera_id || '').replace(/"/g, '""')}"`,
        `"${(e.behaviour || '').replace(/"/g, '""')}"`,
        `"${(e.risk_level || '').replace(/"/g, '""')}"`,
        e.risk_score ?? '',
        `"${(e.description || '').replace(/"/g, '""')}"`,
        `"${(e.reason || '').replace(/"/g, '""')}"`,
        `"${(e.recommended_action || '').replace(/"/g, '""')}"`,
        `"${(e.created_at || '').replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    }

    // Include UTF-8 BOM for Microsoft Excel compatibility
    return new Blob(['\ufeff' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  }
}

export async function acknowledgeIncident(eventId: string, options?: RequestOptions): Promise<Event> {
  const raw = await apiClient.post<Event>(`/incidents/${eventId}/acknowledge`, undefined, options);
  return normalizeEvent(raw);
}

export async function dispatchIncident(eventId: string, options?: RequestOptions): Promise<Event> {
  const raw = await apiClient.post<Event>(`/incidents/${eventId}/dispatch`, undefined, options);
  return normalizeEvent(raw);
}

export async function markFalsePositiveIncident(eventId: string, reason?: string, options?: RequestOptions): Promise<Event> {
  const raw = await apiClient.post<Event>(`/incidents/${eventId}/false-positive`, { reason }, options);
  return normalizeEvent(raw);
}

export async function batchDeleteIncidents(incidentIds: string[], options?: RequestOptions): Promise<{ deleted_count: number; deleted_ids: string[]; status: string }> {
  return await apiClient.delete<{ deleted_count: number; deleted_ids: string[]; status: string }>('/incidents/batch', { incident_ids: incidentIds }, options);
}

export async function batchUpdateIncidentStatus(incidentIds: string[], status: string = 'ACKNOWLEDGED', options?: RequestOptions): Promise<{ updated_count: number; incident_ids: string[]; status: string }> {
  return await apiClient.patch<{ updated_count: number; incident_ids: string[]; status: string }>('/incidents/batch-status', { incident_ids: incidentIds, status }, options);
}



