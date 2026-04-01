import type {
  GenerateRequest,
  GenerateResponse,
  ApiError,
  ApiResult,
  StatusResponse,
  ModelsResponse,
} from '@/types';

interface ModelContextResponse {
  success: true;
  data: { contextLength: number | null };
}

const BASE_URL = '/api';

const DEFAULT_TIMEOUT_MS = 120_000; // 2 min — LLMs are slow

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      return { success: false, error: 'Generation cancelled.' };
    }
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

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
      if (externalSignal?.aborted) {
        return { success: false, error: 'Generation cancelled.' };
      }
      return { success: false, error: 'Request timed out. The model may still be processing.' };
    }

    return { success: false, error: 'Unable to reach the local server. Is it running?' };
  }
}

export async function generatePatentContent(
  req: GenerateRequest,
  signal?: AbortSignal
): Promise<ApiResult<GenerateResponse>> {
  return apiFetch<GenerateResponse>(
    '/generate',
    { method: 'POST', body: JSON.stringify(req) },
    DEFAULT_TIMEOUT_MS,
    signal
  );
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

export async function getModelContextLength(model: string): Promise<number | null> {
  try {
    const encoded = encodeURIComponent(model);
    const result = await apiFetch<ModelContextResponse>(`/models/${encoded}/context`, {}, 5_000);
    if ('success' in result && result.success === false) return null;
    return result.data.contextLength;
  } catch {
    return null;
  }
}

export function isApiError(result: ApiResult<unknown>): result is ApiError {
  return (result as ApiError).success === false;
}
