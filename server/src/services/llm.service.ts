type GenerateParams = {
  model: string;
  prompt: string;
  signal?: AbortSignal;
};

type GenerateResult = {
  response: string;
  promptTokens: number;
  completionTokens: number;
};

import logger from '../logger';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function generate({
  model,
  prompt,
  signal: clientSignal,
}: GenerateParams): Promise<GenerateResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.LLM_TIMEOUT_MS) || 120_000);

  // Abort the Ollama request when the HTTP client disconnects
  if (clientSignal) {
    if (clientSignal.aborted) {
      clearTimeout(timeout);
      return null;
    }
    clientSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
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
      return null;
    }

    const data = await res.json();
    if (!data?.response) return null;

    return {
      response: data.response,
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
    };
  } catch (err) {
    clearTimeout(timeout);
    if ((err as Error).name === 'AbortError') {
      logger.info({ cancelled: !!clientSignal?.aborted }, 'LLM request aborted');
    } else {
      logger.error({ err }, 'LLM request failed');
    }
    return null;
  }
}

export async function checkLLM(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

export async function getModelContextLength(name: string): Promise<number | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/show`, {
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