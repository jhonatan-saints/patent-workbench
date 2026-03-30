import type {
  GenerateRequest,
  GenerateResponse,
  ApiError,
  ApiResult,
  StatusResponse,
  ModelsResponse,
} from '@/types';

const BASE_URL = '/api';

const DEFAULT_TIMEOUT_MS = 120_000; // 2 min — LLMs are slow

// Core Fetch Wrapper
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timer);

    const body = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: body?.error ?? `HTTP ${res.status}`,
        code: String(res.status),
      } satisfies ApiError;
    }

    return body as T;
  } catch (err) {
    clearTimeout(timer);

    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out. The model may still be processing.' };
    }

    // Never expose raw errors to UI — sanitize
    return { success: false, error: 'Unable to reach the local server. Is it running?' };
  }
}

// API Methods
export async function generatePatentContent(
  req: GenerateRequest
): Promise<ApiResult<GenerateResponse>> {
  return apiFetch<GenerateResponse>('/generate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getModels(): Promise<string[]> {
  try {
    const result = await apiFetch<ModelsResponse>('/models', {}, 5_000);
    if ('success' in result && result.success === false) return [];
    return result.data.models;
  } catch {
    return [];
  }
}

export async function getStatus(): Promise<StatusResponse> {
  try {
    const result = await apiFetch<{ success: true; data: StatusResponse }>('/status', {}, 5_000);
    if ('success' in result && result.success === false) {
      return { server: 'error', llm: 'unavailable', latency: 0 };
    }
    return (result as { success: true; data: StatusResponse }).data;
  } catch {
    return { server: 'error', llm: 'unavailable', latency: 0 };
  }
}

// Type Guard
export function isApiError(result: ApiResult<unknown>): result is ApiError {
  return (result as ApiError).success === false;
}
