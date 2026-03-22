type GenerateParams = {
  model: string;
  prompt: string;
};

import logger from '../logger';

const OLLAMA_URL = 'http://localhost:11434';

export async function generate({
  model,
  prompt,
}: GenerateParams): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

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
    return data?.response ?? null;
  } catch (err) {
    if ((err as any).name === 'AbortError') {
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