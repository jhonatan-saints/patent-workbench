import type {
  GenerateRequest,
  GenerateResponse,
  ApiError,
  ApiResult,
  StatusResponse,
  ModelsResponse,
  WorkflowSession,
} from '@/types';

interface ModelContextResponse {
  success: true;
  data: { contextLength: number | null };
}

const BASE_URL = '/api';

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_LLM_TIMEOUT_MS) || 120_000;

// M-4: include API key when the server requires one (set via VITE_API_KEY env var)
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

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
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
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

// Sessions API — short timeout, no abort needed
const SESSIONS_TIMEOUT_MS = 10_000;

export async function fetchSessions(): Promise<WorkflowSession[]> {
  try {
    const result = await apiFetch<{ success: true; data: WorkflowSession[] }>(
      '/sessions',
      {},
      SESSIONS_TIMEOUT_MS
    );
    if (isApiError(result)) return [];
    return result.data;
  } catch {
    return [];
  }
}

export async function saveSession(session: WorkflowSession): Promise<void> {
  try {
    await apiFetch('/sessions', { method: 'POST', body: JSON.stringify(session) }, SESSIONS_TIMEOUT_MS);
  } catch {
    // best-effort — don't surface persistence errors to the user
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await apiFetch(`/sessions/${id}`, { method: 'DELETE' }, SESSIONS_TIMEOUT_MS);
  } catch {
    // best-effort
  }
}

export async function clearAllSessions(): Promise<void> {
  try {
    await apiFetch('/sessions', { method: 'DELETE' }, SESSIONS_TIMEOUT_MS);
  } catch {
    // best-effort
  }
}
