import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { VideoMetadata } from '../types/video';

export async function getVideos(): Promise<VideoMetadata[]> {
  try {
    return await apiClient.get<VideoMetadata[]>(API_ENDPOINTS.VIDEOS);
  } catch (error) {
    console.warn('Backend API /videos error:', error);
    throw error;
  }
}

export async function getVideoById(videoId: string): Promise<VideoMetadata> {
  try {
    return await apiClient.get<VideoMetadata>(API_ENDPOINTS.VIDEO_BY_ID(videoId));
  } catch (error) {
    console.warn(`Backend API /videos/${videoId} error:`, error);
    throw error;
  }
}

