import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { VideoMetadata } from '../types/video';
import { mockVideos, mockVideoMetadata } from './mockData';

export async function getVideos(): Promise<VideoMetadata[]> {
  try {
    return await apiClient.get<VideoMetadata[]>(API_ENDPOINTS.VIDEOS);
  } catch (error) {
    console.warn('Backend API /videos unavailable, falling back to mock data:', error);
    return mockVideos;
  }
}

export async function getVideoById(videoId: string): Promise<VideoMetadata> {
  try {
    return await apiClient.get<VideoMetadata>(API_ENDPOINTS.VIDEO_BY_ID(videoId));
  } catch (error) {
    console.warn(`Backend API /videos/${videoId} unavailable, falling back to mock data:`, error);
    const found = mockVideos.find(v => v.video_id === videoId);
    return found || mockVideoMetadata;
  }
}

