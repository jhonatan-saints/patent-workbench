type GenerateParams = {
  model: string;
  prompt: string;
};

export async function generate({ model, prompt }: GenerateParams): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt }),
    });

    if (!res.ok) {
      console.error('LLM service error', res.statusText);
      return null;
    }

    const data = await res.json();

    // Expecting the API to return { output: '...' } or similar
    if (typeof data === 'string') return data;
    if (data?.output) return data.output;
    if (data?.text) return data.text;
    return JSON.stringify(data);
  } catch (err) {
    console.error('LLM request failed', err);
    return null;
  }
}
