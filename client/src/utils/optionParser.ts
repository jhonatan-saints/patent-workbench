const MIN_OPTION_LENGTH = 20;

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
 * Falls back to the full response as a single option only when the structured
 * format is not detected at all (e.g. the model ignored the instruction).
 * If at least one option is parsed, the partial result is returned rather than
 * falling back, so a "OPTION 1:" response is never discarded in favour of raw text.
 */
export function parseOptions(response: string): string[] {
  const matches: string[] = [];
  const re = /OPTION\s+\d+\s*:\s*\n?([\s\S]*?)(?=OPTION\s+\d+\s*:|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(response)) !== null) {
    const content = match[1].trim();
    if (content.length >= MIN_OPTION_LENGTH) matches.push(content);
  }

  // If we parsed at least one valid option, return what we have.
  // Partial results (fewer than expectedCount) are still more useful than raw text.
  if (matches.length >= 1) return matches;

  // Fallback: treat the whole response as a single option
  const trimmed = response.trim();
  return trimmed.length >= MIN_OPTION_LENGTH ? [trimmed] : [];
}

export function parseOptionsCount(response: string, expectedCount: number): {
  options: string[];
  complete: boolean;
} {
  const options = parseOptions(response);
  return { options, complete: options.length >= expectedCount };
}
