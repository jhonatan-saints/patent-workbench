// Output Sanitizer
// Prevent XSS when rendering LLM output in the DOM.
// We use a plain text approach — no innerHTML, no dangerouslySetInnerHTML.
// Mantine's Text component handles this safely when passed as children.
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
];

export function sanitizeOutput(raw: string): string {
  let sanitized = raw;
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

// Prompt Sanitizer
// Basic client-side cleanup before sending to server.
// Server is source of truth — this is defense-in-depth only.
export function sanitizePrompt(raw: string): string {
  return raw.trim().slice(0, 4000); // hard cap (server enforces its own limit)
}

// ID Generator
// Generates a unique identifier for each prompt or output.
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
