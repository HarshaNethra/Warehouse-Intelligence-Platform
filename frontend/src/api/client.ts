export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 15000;

export function buildSafeUrl(endpoint: string, params?: Record<string, any>): string {
  // Prevent protocol-relative URL injection (e.g. //attacker.com)
  const cleanEndpoint = endpoint.replace(/^\/+/, '/');
  if (cleanEndpoint.startsWith('//')) {
    throw new Error('Invalid endpoint: protocol-relative URLs are forbidden');
  }

  let fullUrl = `${BASE_URL}${cleanEndpoint}`;

  if (params && typeof params === 'object') {
    const queryParams = new URLSearchParams();
    const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);

    Object.entries(params).forEach(([key, value]) => {
      if (unsafeKeys.has(key)) return; // Prevent prototype pollution
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const queryString = queryParams.toString();
    if (queryString) {
      fullUrl += `${fullUrl.includes('?') ? '&' : '?'}${queryString}`;
    }
  }

  return fullUrl;
}

export function getAuthHeaders(contentType?: string): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('wms_auth_token') : null;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function handleResponseError(status: number) {
  if (status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export const apiClient = {
  async get<T>(endpoint: string, params?: Record<string, any>, options?: RequestOptions): Promise<T> {
    const url = buildSafeUrl(endpoint, params);
    
    if (options?.signal?.aborted) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    let effectiveSignal: AbortSignal;
    if (typeof AbortSignal.any === 'function' && options?.signal) {
      effectiveSignal = AbortSignal.any([timeoutController.signal, options.signal]);
    } else if (options?.signal) {
      const combined = new AbortController();
      timeoutController.signal.addEventListener('abort', () => combined.abort(), { once: true });
      options.signal.addEventListener('abort', () => combined.abort(), { once: true });
      effectiveSignal = combined.signal;
    } else {
      effectiveSignal = timeoutController.signal;
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
        signal: effectiveSignal,
      });

      if (!res.ok) {
        handleResponseError(res.status);
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = await res.text();
        }
        throw new ApiError(
          errorData?.detail || `API request failed with status ${res.status}`,
          res.status,
          errorData
        );
      }

      return res.json() as Promise<T>;
    } catch (err: any) {
      if (options?.signal?.aborted || err.name === 'AbortError') {
        if (!timeoutController.signal.aborted) {
          const abortErr = new Error('Request aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
      }
      if (timeoutController.signal.aborted) {
        throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`, 408);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  async post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    const url = buildSafeUrl(endpoint);

    if (options?.signal?.aborted) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    let effectiveSignal: AbortSignal;
    if (typeof AbortSignal.any === 'function' && options?.signal) {
      effectiveSignal = AbortSignal.any([timeoutController.signal, options.signal]);
    } else if (options?.signal) {
      const combined = new AbortController();
      timeoutController.signal.addEventListener('abort', () => combined.abort(), { once: true });
      options.signal.addEventListener('abort', () => combined.abort(), { once: true });
      effectiveSignal = combined.signal;
    } else {
      effectiveSignal = timeoutController.signal;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(body ? 'application/json' : undefined),
        body: body ? JSON.stringify(body) : undefined,
        signal: effectiveSignal,
      });

      if (!res.ok) {
        handleResponseError(res.status);
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = await res.text();
        }
        throw new ApiError(
          errorData?.detail || `API request failed with status ${res.status}`,
          res.status,
          errorData
        );
      }

      return res.json() as Promise<T>;
    } catch (err: any) {
      if (options?.signal?.aborted || err.name === 'AbortError') {
        if (!timeoutController.signal.aborted) {
          const abortErr = new Error('Request aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
      }
      if (timeoutController.signal.aborted) {
        throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`, 408);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  async put<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    const url = buildSafeUrl(endpoint);

    if (options?.signal?.aborted) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    let effectiveSignal: AbortSignal;
    if (typeof AbortSignal.any === 'function' && options?.signal) {
      effectiveSignal = AbortSignal.any([timeoutController.signal, options.signal]);
    } else if (options?.signal) {
      const combined = new AbortController();
      timeoutController.signal.addEventListener('abort', () => combined.abort(), { once: true });
      options.signal.addEventListener('abort', () => combined.abort(), { once: true });
      effectiveSignal = combined.signal;
    } else {
      effectiveSignal = timeoutController.signal;
    }

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: getAuthHeaders(body ? 'application/json' : undefined),
        body: body ? JSON.stringify(body) : undefined,
        signal: effectiveSignal,
      });

      if (!res.ok) {
        handleResponseError(res.status);
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = await res.text();
        }
        throw new ApiError(
          errorData?.detail || `API request failed with status ${res.status}`,
          res.status,
          errorData
        );
      }

      return res.json() as Promise<T>;
    } catch (err: any) {
      if (options?.signal?.aborted || err.name === 'AbortError') {
        if (!timeoutController.signal.aborted) {
          const abortErr = new Error('Request aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
      }
      if (timeoutController.signal.aborted) {
        throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`, 408);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  async delete<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    const url = buildSafeUrl(endpoint);

    if (options?.signal?.aborted) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    let effectiveSignal: AbortSignal;
    if (typeof AbortSignal.any === 'function' && options?.signal) {
      effectiveSignal = AbortSignal.any([timeoutController.signal, options.signal]);
    } else if (options?.signal) {
      const combined = new AbortController();
      timeoutController.signal.addEventListener('abort', () => combined.abort(), { once: true });
      options.signal.addEventListener('abort', () => combined.abort(), { once: true });
      effectiveSignal = combined.signal;
    } else {
      effectiveSignal = timeoutController.signal;
    }

    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(body ? 'application/json' : undefined),
        body: body ? JSON.stringify(body) : undefined,
        signal: effectiveSignal,
      });

      if (!res.ok) {
        handleResponseError(res.status);
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = await res.text();
        }
        throw new ApiError(
          errorData?.detail || `API request failed with status ${res.status}`,
          res.status,
          errorData
        );
      }

      return res.json() as Promise<T>;
    } catch (err: any) {
      if (options?.signal?.aborted || err.name === 'AbortError') {
        if (!timeoutController.signal.aborted) {
          const abortErr = new Error('Request aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
      }
      if (timeoutController.signal.aborted) {
        throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`, 408);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  async patch<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    const url = buildSafeUrl(endpoint);

    if (options?.signal?.aborted) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    let effectiveSignal: AbortSignal;
    if (typeof AbortSignal.any === 'function' && options?.signal) {
      effectiveSignal = AbortSignal.any([timeoutController.signal, options.signal]);
    } else if (options?.signal) {
      const combined = new AbortController();
      timeoutController.signal.addEventListener('abort', () => combined.abort(), { once: true });
      options.signal.addEventListener('abort', () => combined.abort(), { once: true });
      effectiveSignal = combined.signal;
    } else {
      effectiveSignal = timeoutController.signal;
    }

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: getAuthHeaders(body ? 'application/json' : undefined),
        body: body ? JSON.stringify(body) : undefined,
        signal: effectiveSignal,
      });

      if (!res.ok) {
        handleResponseError(res.status);
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = await res.text();
        }
        throw new ApiError(
          errorData?.detail || `API request failed with status ${res.status}`,
          res.status,
          errorData
        );
      }

      return res.json() as Promise<T>;
    } catch (err: any) {
      if (options?.signal?.aborted || err.name === 'AbortError') {
        if (!timeoutController.signal.aborted) {
          const abortErr = new Error('Request aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
      }
      if (timeoutController.signal.aborted) {
        throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`, 408);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  async getBlob(endpoint: string, params?: Record<string, any>, options?: RequestOptions): Promise<Blob> {
    const url = buildSafeUrl(endpoint, params);

    if (options?.signal?.aborted) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

    let effectiveSignal: AbortSignal;
    if (typeof AbortSignal.any === 'function' && options?.signal) {
      effectiveSignal = AbortSignal.any([timeoutController.signal, options.signal]);
    } else if (options?.signal) {
      const combined = new AbortController();
      timeoutController.signal.addEventListener('abort', () => combined.abort(), { once: true });
      options.signal.addEventListener('abort', () => combined.abort(), { once: true });
      effectiveSignal = combined.signal;
    } else {
      effectiveSignal = timeoutController.signal;
    }

    try {
      const headers = getAuthHeaders();
      headers['Accept'] = 'text/csv, application/octet-stream, */*';

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: effectiveSignal,
      });

      if (!res.ok) {
        handleResponseError(res.status);
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = await res.text();
        }
        throw new ApiError(
          errorData?.detail || `API request failed with status ${res.status}`,
          res.status,
          errorData
        );
      }

      return res.blob();
    } catch (err: any) {
      if (options?.signal?.aborted || err.name === 'AbortError') {
        if (!timeoutController.signal.aborted) {
          const abortErr = new Error('Request aborted');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
      }
      if (timeoutController.signal.aborted) {
        throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`, 408);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
};
