import type {
  GenerateRequest,
  GenerateResponse,
  ApiError,
  ApiResult,
  StatusResponse,
  ModelsResponse,
  WorkflowSession,
  AppSettings,
} from '@/types';

interface ModelContextResponse {
  success: true;
  data: { contextLength: number | null };
}

// In dev, VITE_API_BASE is unset and Vite proxies /api → server.
// In production or custom deployments, set VITE_API_BASE=http://your-server to bypass the proxy.
const VITE_API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const BASE_URL = VITE_API_BASE ?? '/api';

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_LLM_TIMEOUT_MS) || 300_000;

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
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ApiResult<GenerateResponse>> {
  return apiFetch<GenerateResponse>(
    '/generate',
    { method: 'POST', body: JSON.stringify(req) },
    timeoutMs,
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

export async function getSession(id: string): Promise<WorkflowSession | null> {
  try {
    const result = await apiFetch<{ success: true; data: WorkflowSession }>(
      `/sessions/${id}`,
      {},
      SESSIONS_TIMEOUT_MS
    );
    if (isApiError(result)) return null;
    return result.data;
  } catch {
    return null;
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

// Settings API
const SETTINGS_TIMEOUT_MS = 5_000;

export async function getSettings(): Promise<AppSettings | null> {
  try {
    const result = await apiFetch<{ success: true; data: AppSettings }>(
      '/settings',
      {},
      SETTINGS_TIMEOUT_MS
    );
    if (isApiError(result)) return null;
    return result.data;
  } catch {
    return null;
  }
}

export async function updateSettings(settings: AppSettings): Promise<AppSettings | null> {
  try {
    const result = await apiFetch<{ success: true; data: AppSettings }>(
      '/settings',
      { method: 'PUT', body: JSON.stringify(settings) },
      SETTINGS_TIMEOUT_MS
    );
    if (isApiError(result)) return null;
    return result.data;
  } catch {
    return null;
  }
}
