type GenerateParams = {
  model: string;
  prompt: string;
};

type GenerateResult = {
  response: string;
  promptTokens: number;
  completionTokens: number;
};

import logger from '../logger';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 120_000;

export async function generate({
  model,
  prompt,
}: GenerateParams): Promise<GenerateResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

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
    if ((err as Error).name === 'AbortError') {
      logger.error('LLM request timeout');
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