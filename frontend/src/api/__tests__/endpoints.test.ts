import { describe, it, expect, vi, afterEach } from 'vitest';
import { API_ENDPOINTS } from '../endpoints';
import { apiClient, buildSafeUrl, ApiError } from '../client';
import { getEvents, getEventById, exportEventsCsv } from '../events';
import { 
  getAnalyticsSummary, 
  getBehaviourAnalytics, 
  getRiskAnalytics, 
  getTimelineAnalytics 
} from '../analytics';
import { askAssistant } from '../assistant';
import { getVideos, getVideoById } from '../videos';
import { mockEvents, mockVideos } from '../mockData';

describe('Frontend API Endpoints Registry & URL Security', () => {
  it('defines all required endpoint paths correctly', () => {
    expect(API_ENDPOINTS.HEALTH).toBe('/health');
    expect(API_ENDPOINTS.VIDEOS).toBe('/videos');
    expect(API_ENDPOINTS.EVENTS).toBe('/events');
    expect(API_ENDPOINTS.EVENTS_EXPORT_CSV).toBe('/events/export/csv');
    expect(API_ENDPOINTS.ANALYTICS_SUMMARY).toBe('/analytics/summary');
    expect(API_ENDPOINTS.ANALYTICS_BEHAVIOURS).toBe('/analytics/behaviours');
    expect(API_ENDPOINTS.ANALYTICS_RISK).toBe('/analytics/risk');
    expect(API_ENDPOINTS.ANALYTICS_TIMELINE).toBe('/analytics/timeline');
    expect(API_ENDPOINTS.ASSISTANT_CHAT).toBe('/assistant/chat');
  });

  it('correctly encodes dynamic route parameters in VIDEO_BY_ID and EVENT_BY_ID', () => {
    expect(API_ENDPOINTS.VIDEO_BY_ID('VID-001')).toBe('/videos/VID-001');
    expect(API_ENDPOINTS.VIDEO_BY_ID('cam 1/feed #2')).toBe('/videos/cam%201%2Ffeed%20%232');
    
    expect(API_ENDPOINTS.EVENT_BY_ID('EVT-100')).toBe('/events/EVT-100');
    expect(API_ENDPOINTS.EVENT_BY_ID('bay/4?special=1')).toBe('/events/bay%2F4%3Fspecial%3D1');
  });

  it('buildSafeUrl appends and sanitizes query parameters', () => {
    const url = buildSafeUrl('/events', {
      risk_level: 'Critical',
      limit: 10,
      emptyField: '',
      nullField: null,
      undefinedField: undefined,
    });
    expect(url).toContain('/api/events?risk_level=Critical&limit=10');
    expect(url).not.toContain('emptyField');
    expect(url).not.toContain('nullField');
    expect(url).not.toContain('undefinedField');
  });

  it('buildSafeUrl neutralizes protocol-relative injections and strips prototype pollution keys', () => {
    // Protocol-relative injection '//evil.com' is normalized to safe relative path '/api/evil.com'
    const safePath = buildSafeUrl('//evil.com');
    expect(safePath.startsWith('//')).toBe(false);
    expect(safePath).toBe('/api/evil.com');

    // Prototype pollution keys (__proto__, constructor, prototype) are strictly stripped
    const pollutedParams = JSON.parse('{"__proto__": {"admin": true}, "search": "drop"}');
    const url = buildSafeUrl('/events', pollutedParams);
    expect(url).toContain('search=drop');
    expect(url).not.toContain('__proto__');
  });
});

describe('Frontend API Client (HTTP Engine)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('performs GET requests with JSON response and Accept header', async () => {
    const mockData = { status: 'healthy', version: '1.0.0' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as any);

    const result = await apiClient.get<typeof mockData>('/health');
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/health'),
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    );
  });

  it('performs POST requests with body and Content-Type header', async () => {
    const requestBody = { question: 'What is the critical incident?' };
    const responsePayload = { answer: 'Forklift near miss in Bay 4' };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responsePayload,
    } as any);

    const result = await apiClient.post<typeof responsePayload>('/assistant/chat', requestBody);
    expect(result).toEqual(responsePayload);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/assistant/chat'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
    );
  });

  it('throws ApiError with HTTP status and detail on non-2xx status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Event not found in repository' }),
    } as any);

    await expect(apiClient.get('/events/EVT-999')).rejects.toThrow(ApiError);
    await expect(apiClient.get('/events/EVT-999')).rejects.toMatchObject({
      status: 404,
      message: 'Event not found in repository',
    });
  });

  it('supports request abort cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        if (opts.signal?.aborted) {
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          return reject(err);
        }
        opts.signal?.addEventListener('abort', () => {
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const promise = apiClient.get('/events', undefined, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('retrieves Blob responses via getBlob', async () => {
    const csvContent = 'event_id,behaviour,risk_score\nEVT-001,Forklift Speeding,85';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([csvContent], { type: 'text/csv' }),
    } as any);

    const blob = await apiClient.getBlob('/events/export/csv');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/csv');
  });
});

describe('Events API Service Layer (getEvents, getEventById, exportEventsCsv)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('getEvents successfully returns normalized events from backend API', async () => {
    const rawApiEvents = [
      {
        event_id: 'EVT-001',
        video_id: 'VID-001',
        timestamp: 14.5,
        bay_id: 'Bay 4',
        camera_id: 'CAM-01',
        behaviour: 'Forklift Near Miss',
        risk_level: 'Critical',
        risk_score: 92,
        description: 'Forklift operated in close proximity to worker',
        reason: 'Violation of buffer zone',
        recommended_action: 'Enforce perimeter barrier',
        created_at: '2026-09-08T10:00:00Z',
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rawApiEvents,
    } as any);

    const events = await getEvents({ risk_level: 'Critical', limit: 10 });
    expect(events.length).toBe(1);
    expect(events[0].event_id).toBe('EVT-001');
    expect(events[0].risk_score).toBe(92);
    expect(events[0].risk_level).toBe('Critical');
  });

  it('getEvents throws error cleanly when backend is offline', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline / connection refused'));

    await expect(getEvents({ risk_level: 'Critical' })).rejects.toThrow('Network offline / connection refused');
  });

  it('getEventById fetches single event and normalizes payload', async () => {
    const sample = mockEvents[0];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sample,
    } as any);

    const event = await getEventById(sample.event_id);
    expect(event.event_id).toBe(sample.event_id);
    expect(event.risk_level).toBe(sample.risk_level);
  });

  it('getEventById throws error cleanly when backend throws error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));

    await expect(getEventById('EVT-001')).rejects.toThrow('500 Internal Server Error');
  });

  it('exportEventsCsv fetches blob from backend export endpoint', async () => {
    const csvData = 'event_id,behaviour\nEVT-001,Unsafe Stacking';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob([csvData], { type: 'text/csv' }),
    } as any);

    const blob = await exportEventsCsv({ risk_level: 'High' });
    expect(blob).toBeInstanceOf(Blob);
  });
});

describe('Analytics API Service Layer (getAnalyticsSummary, getBehaviourAnalytics, getRiskAnalytics, getTimelineAnalytics)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('getAnalyticsSummary queries /analytics/summary and throws on failure', async () => {
    const mockSummary = { summary: { totalEvents: 50, criticalEvents: 5, highRiskEvents: 10, mediumRiskEvents: 20, lowRiskEvents: 15, activeCameras: 8, monitoredBays: 4, averageRiskScore: 42.5 } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSummary,
    } as any);

    const result = await getAnalyticsSummary();
    expect(result.summary.totalEvents).toBe(50);

    // Error propagation test
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(getAnalyticsSummary()).rejects.toThrow('Failed to fetch');
  });

  it('getBehaviourAnalytics queries /analytics/behaviours and throws on failure', async () => {
    const behaviourData = [{ behaviour: 'Forklift Speeding', count: 12, risk_level: 'High' }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => behaviourData,
    } as any);

    const data = await getBehaviourAnalytics();
    expect((data[0] as any).name || (data[0] as any).behaviour).toBe('Forklift Speeding');

    // Error propagation test
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(getBehaviourAnalytics()).rejects.toThrow('Failed to fetch');
  });

  it('getRiskAnalytics queries /analytics/risk and throws on failure', async () => {
    const riskData = [
      { risk_level: 'Critical', count: 4, percentage: 8 },
      { risk_level: 'High', count: 12, percentage: 24 },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => riskData,
    } as any);

    const data = await getRiskAnalytics();
    expect(data.length).toBe(2);

    // Error propagation test
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(getRiskAnalytics()).rejects.toThrow('Failed to fetch');
  });

  it('getTimelineAnalytics queries /analytics/timeline and throws on failure', async () => {
    const timelineData = [{ timestamp: '2026-09-08T08:00:00Z', count: 3, critical_count: 1 }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => timelineData,
    } as any);

    const data = await getTimelineAnalytics();
    expect((data[0] as any).count || (data[0] as any).event_id).toBeDefined();

    // Error propagation test
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(getTimelineAnalytics()).rejects.toThrow('Failed to fetch');
  });
});

describe('Assistant Chat API Service Layer (askAssistant)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('askAssistant queries /assistant/chat with user prompt and returns RAG response', async () => {
    const mockChatResponse = {
      question: 'What are the critical incidents in Bay 4?',
      answer: 'Found 1 critical event in Bay 4 involving pallet destabilization.',
      source_events: [
        {
          event_id: 'EVT-001',
          behaviour: 'Pallet Instability',
          risk_level: 'Critical',
          risk_score: 90,
          timestamp: 22.0,
          bay_id: 'Bay 4',
          description: 'Top carton shifted off center during stacking',
        },
      ],
      model_used: 'claude-3-5-sonnet',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockChatResponse,
    } as any);

    const response = await askAssistant({ question: 'What are the critical incidents in Bay 4?' });
    expect(response.answer).toContain('Bay 4');
    expect(response.source_events.length).toBe(1);
    expect(response.model_used).toBe('claude-3-5-sonnet');
  });

  it('askAssistant throws error cleanly when backend is offline', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Backend unreachable'));

    await expect(askAssistant({ question: 'How can we prevent forklift collisions?' })).rejects.toThrow('Backend unreachable');
  });
});

describe('Videos API Service Layer (getVideos, getVideoById)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('getVideos queries /videos and returns video list', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockVideos,
    } as any);

    const videos = await getVideos();
    expect(videos.length).toBe(mockVideos.length);

    // Error propagation test
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(getVideos()).rejects.toThrow('Network error');
  });

  it('getVideoById queries /videos/{videoId} and returns metadata', async () => {
    const targetVideo = mockVideos[0];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => targetVideo,
    } as any);

    const video = await getVideoById(targetVideo.video_id);
    expect(video.video_id).toBe(targetVideo.video_id);

    // Error propagation test
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(getVideoById('nonexistent_id')).rejects.toThrow('Network error');
  });
});
