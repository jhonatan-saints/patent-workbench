import type { WorkflowModuleId, PatentArtifact } from '@/types';

// Format instruction (appended to every system context)
const THREE_OPTIONS_FORMAT = `

Return EXACTLY 3 distinct options. Use this format with no other text:

OPTION 1:
[content]

OPTION 2:
[content]

OPTION 3:
[content]`;

// Artifact context builder
export const WORKFLOW_ORDER: WorkflowModuleId[] = [
  'idea_analysis',
  'title',
  'field',
  'background',
  'summary',
  'claims',
  'description',
  'abstract',
];

const MAX_SECTION_CHARS = 400;

function truncate(text: string, max = MAX_SECTION_CHARS): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export function buildArtifactContext(
  artifact: PatentArtifact,
  upToModule?: WorkflowModuleId
): string {
  const stopIdx = upToModule ? WORKFLOW_ORDER.indexOf(upToModule) : WORKFLOW_ORDER.length;

  const lines: string[] = [];
  lines.push(`Invention concept: ${artifact.baseIdea}`);
  if (artifact.baseDomain) lines.push(`Technology domain: ${artifact.baseDomain}`);
  if (artifact.constraints) lines.push(`Constraints: ${artifact.constraints}`);

  const priorModules = WORKFLOW_ORDER.slice(0, stopIdx).filter(
    (m) => artifact.sections[m]
  );

  if (priorModules.length > 0) {
    lines.push('', 'Previously selected content:');
    for (const m of priorModules) {
      const section = artifact.sections[m]!;
      const label =
        m === 'idea_analysis'
          ? 'Invention framing'
          : m.charAt(0).toUpperCase() + m.slice(1);
      lines.push(`\n[${label}]`, truncate(section.content));
    }
  }

  return lines.join('\n');
}

// Module definitions
export interface WorkflowModule {
  label: string;
  description: string;
  systemContext: string;
  buildPrompt: (artifact: PatentArtifact) => string;
}

export const WORKFLOW_MODULES: Record<WorkflowModuleId, WorkflowModule> = {
  idea_analysis: {
    label: 'Idea Analysis',
    description: 'Frame the invention technically',
    systemContext: `You are a USPTO patent attorney analyzing an invention concept.
Generate 3 distinct technical framings. Each framing must:
- Identify the core technical problem being solved (1 sentence)
- Describe the key novel technical approach (1–2 sentences)
- State the primary patent claim angle (1 sentence)
Keep each option to 3–5 sentences total.${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `Invention concept: ${artifact.baseIdea}
Technology domain: ${artifact.baseDomain || 'General'}
${artifact.constraints ? `Constraints: ${artifact.constraints}` : ''}

Generate 3 distinct technical framings for patent prosecution.`,
  },

  title: {
    label: 'Title',
    description: 'Generate patent title candidates',
    systemContext: `You are a USPTO patent attorney.
Generate 3 candidate patent titles. Each title must:
- Not start with articles (a, an, the)
- Describe structure or function, not advantages
- Be technically precise and legally appropriate
- Be under 500 characters${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'title')}

Generate 3 patent title candidates.`,
  },

  field: {
    label: 'Field of Invention',
    description: 'Define the technical field',
    systemContext: `You are a patent drafter. Write the "Field of the Invention" section.
Generate 3 options. Each option must:
- State the technical field in 2–4 sentences
- Use formal patent language
- Not claim novelty${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'field')}

Generate 3 options for the Field of Invention section.`,
  },

  background: {
    label: 'Background',
    description: 'Describe prior art and the problem',
    systemContext: `You are a patent attorney writing the Background of the Invention.
Generate 3 options. Each option must:
- Describe prior art objectively (no disparagement)
- Identify the technical problem or need
- Use formal, precise technical language
- Be 2–4 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'background')}

Generate 3 options for the Background of the Invention section.`,
  },

  summary: {
    label: 'Summary',
    description: 'Summarize the invention and advantages',
    systemContext: `You are a patent attorney drafting the Summary of the Invention.
Generate 3 options. Each option must:
- Describe the invention at a high level
- State key features and optional embodiments
- Use "the invention provides..." or "in one embodiment..." language
- Be 2–3 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'summary')}

Generate 3 options for the Summary of the Invention section.`,
  },

  claims: {
    label: 'Claims',
    description: 'Draft independent and dependent claims',
    systemContext: `You are a USPTO patent attorney drafting patent claims.
Generate 3 distinct claim sets. Rules:
- Claim 1 must be an independent claim (broadest scope)
- Each claim is one sentence ending with a period
- Dependent claims reference parent: "The [X] of claim N, wherein..."
- Draft 1 independent + 2–3 dependent claims per option
- Use "comprising" (open-ended), not "consisting of"${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'claims')}

Generate 3 sets of patent claims.`,
  },

  description: {
    label: 'Detailed Description',
    description: 'Write preferred embodiments description',
    systemContext: `You are a patent attorney writing the Detailed Description of Preferred Embodiments.
Generate 3 options. Each option must:
- Enable a person skilled in the art to practice the invention
- Describe at least one embodiment in full detail
- Reference drawings with "FIG. 1 shows..." (hypothetical figures are fine)
- Be 3–5 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'description')}

Generate 3 options for the Detailed Description section.`,
  },

  abstract: {
    label: 'Abstract',
    description: 'Write the patent abstract (max 150 words)',
    systemContext: `You are a patent attorney. Write the Abstract of the Disclosure.
Generate 3 options. USPTO rules per option:
- Maximum 150 words
- One paragraph only
- Discloses: what it is, how it works, primary use
- Written in third person
- No legal conclusions or advantage claims${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact)}

Generate 3 abstract options. Each must be under 150 words.`,
  },
};
