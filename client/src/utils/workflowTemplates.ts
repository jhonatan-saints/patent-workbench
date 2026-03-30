import type { WorkflowModuleId, PatentArtifact } from '@/types';

// Format instruction
const THREE_OPTIONS_FORMAT = `

Return EXACTLY 3 distinct options. Use this format with no other text:

OPTION 1:
[content]

OPTION 2:
[content]

OPTION 3:
[content]`;

// Guided field definition
export interface GuidedField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea';
}

// Artifact context builder (token-optimized)
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

// Keep prior sections short — 200 chars each, rolling last 3 only
const MAX_SECTION_CHARS = 200;
const MAX_PRIOR_SECTIONS = 3;

function truncate(text: string, max = MAX_SECTION_CHARS): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function buildArtifactContext(
  artifact: PatentArtifact,
  upToModule?: WorkflowModuleId
): string {
  const stopIdx = upToModule ? WORKFLOW_ORDER.indexOf(upToModule) : WORKFLOW_ORDER.length;

  const lines: string[] = [];
  lines.push(`Invention: ${truncate(artifact.baseIdea, 200)}`);
  if (artifact.baseDomain) lines.push(`Domain: ${artifact.baseDomain}`);
  if (artifact.constraints) lines.push(`Notes: ${truncate(artifact.constraints, 120)}`);
  if (artifact.inventors.length > 0) {
    lines.push(`Inventor(s): ${artifact.inventors.map((inv) => inv.name).join(', ')}`);
  }

  const priorModules = WORKFLOW_ORDER.slice(0, stopIdx)
    .filter((m) => artifact.sections[m])
    .slice(-MAX_PRIOR_SECTIONS); // rolling window

  if (priorModules.length > 0) {
    lines.push('', 'Prior sections:');
    for (const m of priorModules) {
      const section = artifact.sections[m]!;
      const label =
        m === 'idea_analysis'
          ? 'Framing'
          : m.charAt(0).toUpperCase() + m.slice(1);
      lines.push(`[${label}] ${truncate(section.content)}`);
    }
  }

  return lines.join('\n');
}

// Section labels
export const SECTION_LABELS: Record<WorkflowModuleId, string> = {
  idea_analysis: 'Invention Framing',
  title: 'Title',
  field: 'Field of Invention',
  background: 'Background of the Invention',
  summary: 'Summary of the Invention',
  claims: 'Claims',
  description: 'Detailed Description',
  abstract: 'Abstract',
};

// Module definitions
export interface WorkflowModule {
  label: string;
  description: string;
  systemContext: string;
  buildPrompt: (artifact: PatentArtifact) => string;
  guidedFields: GuidedField[];
  buildGuidedPrompt: (artifact: PatentArtifact, fields: Record<string, string>) => string;
}

export const WORKFLOW_MODULES: Record<WorkflowModuleId, WorkflowModule> = {
  idea_analysis: {
    label: 'Idea Analysis',
    description: 'Frame the invention technically',
    systemContext: `You are a USPTO patent attorney analyzing an invention concept.
Generate 3 distinct technical framings. Each must:
- Identify the core technical problem (1 sentence)
- Describe the novel technical approach (1–2 sentences)
- State the primary patent claim angle (1 sentence)
Keep each to 3–5 sentences total.${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `Invention: ${artifact.baseIdea}
Domain: ${artifact.baseDomain || 'General'}
${artifact.constraints ? `Notes: ${artifact.constraints}` : ''}

Generate 3 distinct technical framings for patent prosecution.`,
    guidedFields: [
      {
        key: 'problem',
        label: 'Core Technical Problem',
        placeholder: 'e.g., Existing NLP systems expose private data to cloud models...',
        type: 'textarea',
      },
      {
        key: 'approach',
        label: 'Novel Technical Approach',
        placeholder: 'e.g., Schema-level abstraction with local entity recognition...',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `Invention: ${artifact.baseIdea}
Domain: ${artifact.baseDomain || 'General'}
Core problem: ${fields['problem'] || ''}
Novel approach: ${fields['approach'] || ''}

Generate 3 technical framings for patent prosecution based on these specifics.`,
  },

  title: {
    label: 'Title',
    description: 'Generate patent title candidates',
    systemContext: `You are a USPTO patent attorney.
Generate 3 candidate patent titles. Each must:
- Not start with "A", "An", or "The"
- Describe structure or function, not advantages
- Be technically precise and legally appropriate
- Be under 500 characters${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'title')}

Generate 3 patent title candidates.`,
    guidedFields: [
      {
        key: 'key_terms',
        label: 'Key Technical Terms',
        placeholder: 'e.g., schema-level abstraction, local entity recognition, NLP querying',
        type: 'text',
      },
      {
        key: 'emphasis',
        label: 'Technical Aspect to Emphasize',
        placeholder: 'e.g., privacy-preserving, model-agnostic, real-time',
        type: 'text',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'title')}
Key terms to include: ${fields['key_terms'] || ''}
Emphasis: ${fields['emphasis'] || ''}

Generate 3 patent title candidates incorporating these terms.`,
  },

  field: {
    label: 'Field of Invention',
    description: 'Define the technical field',
    systemContext: `You are a patent drafter. Write the "Field of the Invention" section.
Generate 3 options. Each must:
- State the technical field in 2–4 sentences
- Use formal patent language
- Not claim novelty${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'field')}

Generate 3 options for the Field of the Invention section.`,
    guidedFields: [
      {
        key: 'industry',
        label: 'Industry / Sector',
        placeholder: 'e.g., Software, Medical Devices, Telecommunications',
        type: 'text',
      },
      {
        key: 'sub_domain',
        label: 'Specific Sub-domain',
        placeholder: 'e.g., Natural Language Processing, Computer Vision, Robotics',
        type: 'text',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'field')}
Industry: ${fields['industry'] || ''}
Sub-domain: ${fields['sub_domain'] || ''}

Generate 3 Field of the Invention options for this industry and sub-domain.`,
  },

  background: {
    label: 'Background',
    description: 'Describe prior art and the problem',
    systemContext: `You are a patent attorney writing the Background of the Invention.
Generate 3 options. Each must:
- Describe prior art objectively (no disparagement)
- Identify the technical problem or need
- Use formal, precise technical language
- Be 2–4 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'background')}

Generate 3 Background of the Invention options.`,
    guidedFields: [
      {
        key: 'prior_art',
        label: 'Prior Art Systems / Methods to Mention',
        placeholder: 'e.g., transformer-based NL-to-SQL systems, cloud data analytics platforms',
        type: 'textarea',
      },
      {
        key: 'problems',
        label: 'Key Technical Problems to Address',
        placeholder: 'e.g., data exposure risk, context window limitations, high API costs',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'background')}
Prior art: ${fields['prior_art'] || ''}
Problems: ${fields['problems'] || ''}

Generate 3 Background of the Invention options addressing these prior art and problems.`,
  },

  summary: {
    label: 'Summary',
    description: 'Summarize the invention and advantages',
    systemContext: `You are a patent attorney drafting the Summary of the Invention.
Generate 3 options. Each must:
- Describe the invention at a high level
- State key features and optional embodiments
- Use "the invention provides…" or "in one embodiment…" language
- Be 2–3 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'summary')}

Generate 3 Summary of the Invention options.`,
    guidedFields: [
      {
        key: 'key_features',
        label: 'Key Features to Highlight',
        placeholder: 'e.g., schema-only model access, local anonymization, function-call architecture',
        type: 'textarea',
      },
      {
        key: 'embodiments',
        label: 'Number / Type of Embodiments',
        placeholder: 'e.g., 2 embodiments: standalone app and cloud-hybrid mode',
        type: 'text',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'summary')}
Key features: ${fields['key_features'] || ''}
Embodiments: ${fields['embodiments'] || ''}

Generate 3 Summary of the Invention options emphasizing these features.`,
  },

  claims: {
    label: 'Claims',
    description: 'Draft independent and dependent claims',
    systemContext: `You are a USPTO patent attorney drafting patent claims.
Generate 3 distinct claim sets. Rules:
- Claim 1 must be an independent claim (broadest scope)
- Each claim is one sentence ending with a period
- Dependent claims: "The [X] of claim N, wherein…"
- Draft 1 independent + 2–3 dependent claims per option
- Use "comprising" (open-ended), not "consisting of"${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'claims')}

Generate 3 sets of patent claims.`,
    guidedFields: [
      {
        key: 'independent_focus',
        label: 'Focus of the Independent Claim',
        placeholder: 'e.g., A computer-implemented method for privacy-preserving data visualization…',
        type: 'textarea',
      },
      {
        key: 'dependent_aspects',
        label: 'Aspects for Dependent Claims',
        placeholder: 'e.g., local entity recognition, function-call mechanism, dynamic visualization selection',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'claims')}
Independent claim focus: ${fields['independent_focus'] || ''}
Dependent claim aspects: ${fields['dependent_aspects'] || ''}

Generate 3 claim sets with 1 independent + 2–3 dependent claims each.`,
  },

  description: {
    label: 'Detailed Description',
    description: 'Write preferred embodiments description',
    systemContext: `You are a patent attorney writing the Detailed Description of Preferred Embodiments.
Generate 3 options. Each must:
- Enable a person skilled in the art to practice the invention
- Describe at least one embodiment in full detail
- Reference drawings with "FIG. 1 shows…" (hypothetical figures are fine)
- Be 3–5 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'description')}

Generate 3 Detailed Description options.`,
    guidedFields: [
      {
        key: 'embodiments',
        label: 'Embodiments to Detail',
        placeholder: 'e.g., primary embodiment with local DB, second embodiment with cloud schema proxy',
        type: 'textarea',
      },
      {
        key: 'components',
        label: 'Key Components / Elements',
        placeholder: 'e.g., schema extractor, local NER model, query generator, visualization dispatcher',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'description')}
Embodiments: ${fields['embodiments'] || ''}
Key components: ${fields['components'] || ''}

Generate 3 Detailed Description options covering these embodiments and components.`,
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
    guidedFields: [
      {
        key: 'key_aspect',
        label: 'Primary Aspect to Emphasize',
        placeholder: 'e.g., privacy-preserving architecture, model-agnostic design',
        type: 'text',
      },
      {
        key: 'use_case',
        label: 'Primary Use Case',
        placeholder: 'e.g., enterprise data analytics, contact center reporting',
        type: 'text',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact)}
Primary aspect: ${fields['key_aspect'] || ''}
Use case: ${fields['use_case'] || ''}

Generate 3 abstract options (under 150 words each) emphasizing this aspect and use case.`,
  },
};
