/**
 * Centralized API Endpoints Registry
 * Defines type-safe paths for all platform backend routes.
 */
export const API_ENDPOINTS = {
  HEALTH: '/health',
  VIDEOS: '/videos',
  VIDEO_BY_ID: (videoId: string) => `/videos/${encodeURIComponent(videoId)}`,
  EVENTS: '/events',
  EVENT_BY_ID: (eventId: string) => `/events/${encodeURIComponent(eventId)}`,
  EVENTS_EXPORT_CSV: '/events/export/csv',
  ANALYTICS_SUMMARY: '/analytics/summary',
  ANALYTICS_BEHAVIOURS: '/analytics/behaviours',
  ANALYTICS_RISK: '/analytics/risk',
  ANALYTICS_TIMELINE: '/analytics/timeline',
  ASSISTANT_CHAT: '/assistant/chat',
  MODEL_EVALUATION: '/ml/metrics/evaluation',
  MODEL_STATUS: '/ml/model/status',
  MODEL_SWITCH: '/ml/model/switch',
} as const;
