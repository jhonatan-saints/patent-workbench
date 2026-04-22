import type {
  GenerateRequest,
  GenerateResponse,
  ApiError,
  ApiResult,
  StatusResponse,
  ModelsResponse,
  WorkflowSession,
  AppSettings,
  RegTemplate,
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

// M-4: API key — env var is the build-time default; loadSettings() overrides at runtime.
let _apiKey: string | undefined = import.meta.env.VITE_API_KEY as string | undefined;

export function setApiKey(key: string | undefined): void {
  _apiKey = key || undefined;
}

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
        ...(_apiKey ? { 'x-api-key': _apiKey } : {}),
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

type SseStreamEvent =
  | { chunk: string }
  | { done: true; promptTokens: number; completionTokens: number }
  | { error: string };

function parseSseEvent(raw: string): SseStreamEvent | null {
  if (!raw.startsWith('data: ')) return null;
  try {
    return JSON.parse(raw.slice(6)) as SseStreamEvent;
  } catch {
    return null;
  }
}

type SseApplyResult =
  | { type: 'error'; error: string }
  | { type: 'tokens'; promptTokens: number; completionTokens: number }
  | null;

function applySseEvent(event: SseStreamEvent, onChunk: (text: string) => void): SseApplyResult {
  if ('error' in event) return { type: 'error', error: event.error };
  if ('chunk' in event) { onChunk(event.chunk); return null; }
  return { type: 'tokens', promptTokens: event.promptTokens, completionTokens: event.completionTokens };
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
): Promise<ApiResult<{ promptTokens: number; completionTokens: number }>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalTokens = { promptTokens: 0, completionTokens: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const event = parseSseEvent(part);
      if (!event) continue;
      const result = applySseEvent(event, onChunk);
      if (!result) continue;
      if (result.type === 'error') return { success: false, error: result.error };
      finalTokens = { promptTokens: result.promptTokens, completionTokens: result.completionTokens };
    }
  }

  return finalTokens;
}

export async function streamPatentContent(
  req: GenerateRequest,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ApiResult<{ promptTokens: number; completionTokens: number }>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal?.aborted) {
    clearTimeout(timer);
    return { success: false, error: 'Generation cancelled.' };
  }
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const res = await fetch(`${BASE_URL}/generate/stream`, {
      method: 'POST',
      body: JSON.stringify(req),
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(_apiKey ? { 'x-api-key': _apiKey } : {}),
      },
    });

    clearTimeout(timer);

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({} as { error?: string }));
      return { success: false, error: (body as { error?: string }).error ?? `HTTP ${res.status}` };
    }

    return readSseStream(res.body, onChunk);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (signal?.aborted) return { success: false, error: 'Generation cancelled.' };
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

export async function resetSettings(): Promise<AppSettings | null> {
  try {
    const result = await apiFetch<{ success: true; data: AppSettings }>(
      '/settings/reset',
      { method: 'POST' },
      SETTINGS_TIMEOUT_MS
    );
    if (isApiError(result)) return null;
    return result.data;
  } catch {
    return null;
  }
}

export async function getTemplate(): Promise<RegTemplate | null> {
  try {
    const result = await apiFetch<{ success: true; data: RegTemplate }>('/template', {}, SETTINGS_TIMEOUT_MS);
    if (isApiError(result)) return null;
    return result.data;
  } catch {
    return null;
  }
}

export async function updateTemplate(template: RegTemplate): Promise<RegTemplate | null> {
  try {
    const result = await apiFetch<{ success: true; data: RegTemplate }>(
      '/template',
      { method: 'PUT', body: JSON.stringify(template) },
      SETTINGS_TIMEOUT_MS
    );
    if (isApiError(result)) return null;
    return result.data;
  } catch {
    return null;
  }
}

// Backups API
export async function exportBackup(): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/backups/export`, {
      headers: { ...(_apiKey ? { 'x-api-key': _apiKey } : {}) },
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `workbench-backup-${stamp}.db`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // best-effort
  }
}

export async function importBackup(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    const buf = await file.arrayBuffer()
    const res = await fetch(`${BASE_URL}/backups/import`, {
      method: 'POST',
      body: buf,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(_apiKey ? { 'x-api-key': _apiKey } : {}),
      },
      signal: AbortSignal.timeout(60_000),
    })
    return await res.json() as { success: boolean; error?: string }
  } catch {
    return { success: false, error: 'Request failed' }
  }
}

export async function resetTemplate(): Promise<RegTemplate | null> {
  try {
    const result = await apiFetch<{ success: true; data: RegTemplate }>(
      '/template/reset',
      { method: 'POST' },
      SETTINGS_TIMEOUT_MS
    );
    if (isApiError(result)) return null;
    return result.data;
  } catch {
    return null;
  }
}
