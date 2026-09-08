import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { ChatRequest, ChatResponse } from '../types/assistant';

export async function askAssistant(request: ChatRequest): Promise<ChatResponse> {
  try {
    return await apiClient.post<ChatResponse>(API_ENDPOINTS.ASSISTANT_CHAT, request);
  } catch (error) {
    console.warn('Backend API /assistant/chat error:', error);
    throw error;
  }
}
