/**
 * Parses a structured LLM response into discrete options.
 *
 * Expected format:
 *   OPTION 1:
 *   [content]
 *
 *   OPTION 2:
 *   [content]
 *
 *   OPTION 3:
 *   [content]
 *
 * Falls back to returning the full response as a single option if the format
 * is not detected (e.g. the model ignored the instruction).
 */
export function parseOptions(response: string): string[] {
  const matches: string[] = [];
  const re = /OPTION\s+\d+\s*:\s*\n?([\s\S]*?)(?=OPTION\s+\d+\s*:|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(response)) !== null) {
    const content = match[1].trim();
    if (content) matches.push(content);
  }

  if (matches.length >= 2) return matches.slice(0, 3);

  // Fallback: whole response as one option
  const trimmed = response.trim();
  return trimmed ? [trimmed] : [];
}
