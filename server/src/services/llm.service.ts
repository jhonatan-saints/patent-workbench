type GenerateParams = {
  model: string;
  prompt: string;
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

export async function generate({
  model,
  prompt,
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

  try {
    const res = await fetch(`${settings.ollama_url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

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

export async function* generateStream({
  model,
  prompt,
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

  let res: Response;
  try {
    res = await fetch(`${settings.ollama_url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt, stream: true }),
    });
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
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const event = parseOllamaLine(line);
        if (!event) continue;
        if (event.done) { clearTimeout(timeout); yield event; return; }
        yield event;
      }
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