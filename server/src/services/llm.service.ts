type GenerateParams = {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  signal?: AbortSignal;
};

type GenerateResult = {
  ok: true;
  response: string;
  promptTokens: number;
  completionTokens: number;
};

type GenerateFailure = {
  ok: false;
  reason: 'timeout' | 'cancelled' | 'offline' | 'llm_error' | 'invalid_response';
};

export type GenerateOutcome = GenerateResult | GenerateFailure;

import logger from '../logger';
import { getAppSettings } from './db';

// Disable undici's built-in headersTimeout and bodyTimeout on all LLM requests.
// Our AbortController already enforces llm_timeout_ms; the undici defaults (~30s)
// fire before long model-loading or first-token generation can complete.
// We use `node:undici` (the same undici instance that Node's global fetch uses)
// so the dispatcher is actually honoured by fetch().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ollamaAgent: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Agent } = require('node:undici') as { Agent: new (opts: object) => unknown };
  ollamaAgent = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
} catch {
  ollamaAgent = undefined;
}

function withDispatcher(init: RequestInit): RequestInit {
  if (!ollamaAgent) return init;
  return { ...init, dispatcher: ollamaAgent } as RequestInit & { dispatcher: unknown };
}

function buildOllamaOptions(
  numCtx: number | undefined,
  temperature: number | undefined,
): Record<string, unknown> | undefined {
  const opts: Record<string, unknown> = {};
  if (numCtx) opts.num_ctx = numCtx;
  if (temperature !== undefined) opts.temperature = temperature;
  return Object.keys(opts).length ? opts : undefined;
}

export async function generate({
  model,
  prompt,
  system,
  temperature,
  signal: clientSignal,
}: GenerateParams): Promise<GenerateOutcome> {
  const settings = getAppSettings();
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, settings.llm_timeout_ms);

  // Abort the Ollama request when the HTTP client disconnects
  if (clientSignal?.aborted) {
    clearTimeout(timeout);
    return { ok: false, reason: 'cancelled' };
  }
  clientSignal?.addEventListener('abort', () => controller.abort(), { once: true });

  const ollamaOptions = buildOllamaOptions(resolveNumCtx(prompt, system), temperature);

  try {
    const res = await fetch(`${settings.ollama_url}/api/generate`, withDispatcher({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt, system, ...(ollamaOptions ? { options: ollamaOptions } : null), stream: false }),
    }));

    clearTimeout(timeout);

    if (!res.ok) {
      logger.error({ statusText: res.statusText }, 'LLM service error');
      return { ok: false, reason: 'llm_error' };
    }

    const data = await res.json();
    if (!data?.response) {
      return { ok: false, reason: 'invalid_response' };
    }

    return {
      ok: true,
      response: data.response,
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
    };
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error).name === 'AbortError') {
      const reason = timedOut ? 'timeout' : 'cancelled';
      logger.info({ reason }, 'LLM request aborted');
      return { ok: false, reason };
    }
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      logger.error({ err }, 'Ollama unreachable');
      return { ok: false, reason: 'offline' };
    }
    logger.error({ err }, 'LLM request failed');
    return { ok: false, reason: 'llm_error' };
  }
}

export type StreamToken =
  | { done: false; token: string }
  | { done: true; promptTokens: number; completionTokens: number }
  | { error: GenerateFailure['reason'] };

type OllamaLineEvent =
  | { done: false; token: string }
  | { done: true; promptTokens: number; completionTokens: number };

function parseOllamaLine(line: string): OllamaLineEvent | null {
  if (!line.trim()) return null;
  try {
    const data = JSON.parse(line) as { done?: boolean; response?: string; prompt_eval_count?: number; eval_count?: number };
    if (data.done) return { done: true, promptTokens: data.prompt_eval_count ?? 0, completionTokens: data.eval_count ?? 0 };
    if (data.response) return { done: false, token: data.response };
  } catch {
    // skip malformed line
  }
  return null;
}

function classifyStreamError(err: unknown, timedOut: boolean): GenerateFailure['reason'] {
  if ((err as Error).name === 'AbortError') return timedOut ? 'timeout' : 'cancelled';
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') return 'offline';
  return 'llm_error';
}

// Ollama defaults num_ctx to 2048–4096 depending on version.
// Review calls send system+document that can exceed 16 000 chars (~4 000 tokens),
// which overflows small defaults and causes the model to error or truncate silently.
// When the combined input is large, request a wider context window explicitly.
function resolveNumCtx(prompt: string, system?: string): number | undefined {
  const totalChars = prompt.length + (system?.length ?? 0);
  if (totalChars > 20_000) return 32_768;
  if (totalChars > 12_000) return 16_384;
  if (totalChars > 6_000) return 8_192;
  return undefined;
}

export async function* generateStream({
  model,
  prompt,
  system,
  temperature,
  signal: clientSignal,
}: GenerateParams): AsyncGenerator<StreamToken> {
  const settings = getAppSettings();
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, settings.llm_timeout_ms);

  if (clientSignal?.aborted) {
    clearTimeout(timeout);
    yield { error: 'cancelled' as const };
    return;
  }
  clientSignal?.addEventListener('abort', () => controller.abort(), { once: true });

  const ollamaOptions = buildOllamaOptions(resolveNumCtx(prompt, system), temperature);

  let res: Response;
  try {
    res = await fetch(`${settings.ollama_url}/api/generate`, withDispatcher({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt, system, ...(ollamaOptions ? { options: ollamaOptions } : null), stream: true }),
    }));
  } catch (err) {
    clearTimeout(timeout);
    const reason = classifyStreamError(err, timedOut);
    logger.error({ err, reason }, 'LLM stream connect error');
    yield { error: reason };
    return;
  }

  if (!res.ok || !res.body) {
    clearTimeout(timeout);
    logger.error({ statusText: res.statusText }, 'LLM stream error');
    yield { error: 'llm_error' as const };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    let chunk = await reader.read();
    while (!chunk.done) {
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const event = parseOllamaLine(line);
        if (!event) continue;
        if (event.done) { clearTimeout(timeout); yield event; return; }
        yield event;
      }
      chunk = await reader.read();
    }
  } catch (err) {
    const reason = classifyStreamError(err, timedOut);
    logger.error({ err, reason }, 'LLM stream read error');
    yield { error: reason };
    return;
  }
  clearTimeout(timeout);
}

export async function checkLLM(): Promise<boolean> {
  try {
    const { ollama_url } = getAppSettings();
    const res = await fetch(`${ollama_url}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels(): Promise<string[]> {
  try {
    const { ollama_url } = getAppSettings();
    const res = await fetch(`${ollama_url}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

export async function getModelContextLength(name: string): Promise<number | null> {
  try {
    const { ollama_url } = getAppSettings();
    const res = await fetch(`${ollama_url}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Only trust num_ctx explicitly set in the Modelfile parameters.
    // The Ollama app can override context at runtime globally — that setting
    // is NOT exposed by /api/show, so model_info.*.context_length (architectural
    // maximum) cannot be used reliably and is ignored here.
    const params: string = data?.parameters ?? '';
    const numCtxMatch = /(?:^|\n)num_ctx\s+(\d+)/.exec(params);
    return numCtxMatch ? Number(numCtxMatch[1]) : null;
  } catch {
    return null;
  }
}