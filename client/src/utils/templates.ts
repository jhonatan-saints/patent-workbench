import type { PatentPromptTemplate, PatentSection } from '../types';

// REG Prompt System
// REG = Role + Examples + Goal
// Each template provides structured context to maximize LLM patent output quality
// while keeping token usage predictable and bounded.

export const PATENT_TEMPLATES: Record<PatentSection, PatentPromptTemplate> = {
  title: {
    id: 'title',
    label: 'Title',
    description: 'Generate precise, legally-appropriate patent titles',
    systemContext: `You are a USPTO patent attorney specializing in claim drafting. 
Generate concise, technically precise patent titles following USPTO guidelines.
Rules: 
- No articles (a, an, the) at the start
- Describe the invention's structure or function, not its advantage
- Maximum 500 characters
- Return only the title, no explanation`,
    userTemplate: `Invention concept: {concept}
Field: {field}

Generate 3 candidate patent titles.`,
    tokenEstimate: 180,
  },

  field: {
    id: 'field',
    label: 'Field of Invention',
    description: 'Draft the technical field statement',
    systemContext: `You are a patent drafter. Write the "Field of the Invention" section.
This section: briefly states the technical field, uses formal patent language, is 2-4 sentences maximum.
Return only the field statement, no headings or explanation.`,
    userTemplate: `Invention: {concept}
Technology domain: {field}

Write the Field of Invention section.`,
    tokenEstimate: 150,
  },

  background: {
    id: 'background',
    label: 'Background',
    description: 'Describe prior art and the problem being solved',
    systemContext: `You are a patent attorney writing the Background section of a patent application.
This section must:
- Describe the prior art objectively (no disparagement)
- Identify the technical problem or need
- Avoid claiming novelty (that comes in claims)
- Use formal, precise technical language
- Be 3-6 paragraphs`,
    userTemplate: `Invention summary: {concept}
Known prior art / existing solutions: {priorArt}
Problem this solves: {problem}

Write the Background of the Invention section.`,
    tokenEstimate: 350,
  },

  summary: {
    id: 'summary',
    label: 'Summary',
    description: 'Summarize the invention and its key advantages',
    systemContext: `You are a patent attorney drafting the Summary of the Invention.
This section must:
- Briefly describe the invention at a high level
- State key features and optional embodiments
- Use "the invention provides..." or "in one embodiment..." language
- Not repeat the claims verbatim
- Be 2-4 paragraphs`,
    userTemplate: `Core invention: {concept}
Key technical features: {features}
Main advantages: {advantages}

Write the Summary of the Invention section.`,
    tokenEstimate: 300,
  },

  claims: {
    id: 'claims',
    label: 'Claims',
    description: 'Draft independent and dependent patent claims',
    systemContext: `You are a USPTO patent attorney. Draft patent claims following strict USPTO format.
Rules:
- Claim 1 must be an independent claim (broadest)
- Each claim is one sentence ending with a period
- Use functional and structural language
- Dependent claims reference parent: "The [X] of claim N, wherein..."
- Draft 1 independent + 3-5 dependent claims
- Use "comprising" (open-ended) not "consisting of"`,
    userTemplate: `Invention: {concept}
Core technical elements: {elements}
Novel aspects: {novelty}

Draft patent claims.`,
    tokenEstimate: 450,
  },

  description: {
    id: 'description',
    label: 'Detailed Description',
    description: 'Write the detailed description of preferred embodiments',
    systemContext: `You are a patent attorney writing the Detailed Description of the Preferred Embodiments.
This section must:
- Enable a person skilled in the art to practice the invention
- Describe at least one embodiment in full detail
- Reference drawings with "FIG. 1 shows..." (even if hypothetical)
- Use consistent reference numerals for elements
- Be thorough enough to satisfy the enablement requirement
- 4-8 paragraphs`,
    userTemplate: `Invention: {concept}
Components/elements: {elements}
How it works (operation): {operation}
Embodiment variants: {variants}

Write the Detailed Description section.`,
    tokenEstimate: 600,
  },

  abstract: {
    id: 'abstract',
    label: 'Abstract',
    description: 'Write the patent abstract (USPTO: max 150 words)',
    systemContext: `You are a patent attorney. Write the Abstract of the Disclosure.
USPTO rules:
- Maximum 150 words
- One paragraph only
- Discloses: what it is, how it works, primary use
- No legal conclusions or advantage claims
- Written in third person
Return only the abstract text.`,
    userTemplate: `Invention: {concept}
Key mechanism: {mechanism}
Primary application: {application}

Write the Abstract. Stay under 150 words.`,
    tokenEstimate: 200,
  },
};

export const SECTION_ORDER: PatentSection[] = [
  'title',
  'field',
  'background',
  'summary',
  'claims',
  'description',
  'abstract',
];

// Rough estimation: ~4 chars per token (English text)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function buildPrompt(
  template: PatentPromptTemplate,
  variables: Record<string, string>
): string {
  let prompt = template.userTemplate;
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{${key}}`, value.trim());
  }
  return prompt;
}

export function buildFullPrompt(
  template: PatentPromptTemplate,
  variables: Record<string, string>
): string {
  const userPrompt = buildPrompt(template, variables);
  return `[SYSTEM]\n${template.systemContext}\n\n[USER]\n${userPrompt}`;
}
