type GenerateParams = {
  model: string;
  prompt: string;
};
const DEFAULT_TIMEOUT = 30_000;

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3001';

export async function generate({ model, prompt }: GenerateParams): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error('LLM service error', res.statusText);
      return null;
    }

    const data = await res.json();

    // Expected server shape: { success: true, data: { response: '...' } }
    if (data?.data?.response) return data.data.response;

    // Backwards-compatible shapes
    if (typeof data === 'string') return data;
    if (data?.output) return data.output;
    if (data?.text) return data.text;

    return null;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('LLM request timeout');
    } else {
      console.error('LLM request failed', err);
    }
    return null;
  }
}
