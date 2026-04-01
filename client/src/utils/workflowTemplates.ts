import type { WorkflowModuleId, PatentArtifact } from '@/types';

const THREE_OPTIONS_FORMAT = `

Return EXACTLY 3 distinct options. Use this format with no other text:

OPTION 1:
[content]

OPTION 2:
[content]

OPTION 3:
[content]`;

export interface GuidedField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea';
}

export const WORKFLOW_ORDER: WorkflowModuleId[] = [
  'problem',
  'previous_solutions',
  'differences',
  'invention_summary',
  'variations',
  'other_applications',
  'full_description',
];

const MAX_SECTION_CHARS = 200;
const MAX_PRIOR_SECTIONS = 3;
const MAX_CONTEXT_FILE_CHARS = 40_000; // total across all files

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
    .slice(-MAX_PRIOR_SECTIONS);

  if (priorModules.length > 0) {
    lines.push('', 'Prior sections:');
    for (const m of priorModules) {
      const section = artifact.sections[m]!;
      const label = SECTION_LABELS[m];
      lines.push(`[${label}] ${truncate(section.content)}`);
    }
  }

  if (artifact.contextFiles?.length) {
    lines.push('', 'Reference documents:');
    let remaining = MAX_CONTEXT_FILE_CHARS;
    for (const file of artifact.contextFiles) {
      if (remaining <= 0) break;
      const content = file.content.slice(0, remaining);
      lines.push(`[${file.name}]\n${content}`);
      remaining -= content.length;
    }
  }

  return lines.join('\n');
}

export const SECTION_LABELS: Record<WorkflowModuleId, string> = {
  problem: 'Problem Description',
  previous_solutions: 'Previous Solutions',
  differences: 'Key Differences',
  invention_summary: 'Invention Summary',
  variations: 'Possible Variations',
  other_applications: 'Other Applications',
  full_description: 'Full Description',
};

export interface WorkflowModule {
  label: string;
  description: string;
  systemContext: string;
  buildPrompt: (artifact: PatentArtifact) => string;
  guidedFields: GuidedField[];
  buildGuidedPrompt: (artifact: PatentArtifact, fields: Record<string, string>) => string;
}

export const WORKFLOW_MODULES: Record<WorkflowModuleId, WorkflowModule> = {
  problem: {
    label: 'Problem Description',
    description: 'Describe the problem this invention solves',
    systemContext: `You are a patent analyst writing the Problem Description section of an IDF (Invention Disclosure Form).
Generate 3 options. Each must:
- Clearly articulate the business or technical problem that motivated the invention
- Explain why existing approaches fail or are inadequate
- Be written in plain, clear language (not legal jargon)
- Be 2–4 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'problem')}

Generate 3 Problem Description options for this invention.`,
    guidedFields: [
      {
        key: 'pain_point',
        label: 'Core Pain Point',
        placeholder: 'e.g., Agents cannot determine customer emotional state before a call...',
        type: 'textarea',
      },
      {
        key: 'impact',
        label: 'Business / User Impact',
        placeholder: 'e.g., Leads to suboptimal call routing and poor customer satisfaction...',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'problem')}
Core pain point: ${fields['pain_point'] || ''}
Business impact: ${fields['impact'] || ''}

Generate 3 Problem Description options based on these specifics.`,
  },

  previous_solutions: {
    label: 'Previous Solutions',
    description: 'Describe existing approaches and their limitations',
    systemContext: `You are a patent analyst writing the Previous Solutions section of an IDF.
Generate 3 options. Each must:
- Describe current methods or technologies used to address the problem
- Explain their limitations, gaps, or drawbacks
- Be objective and factual (no disparagement)
- Be 2–3 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'previous_solutions')}

Generate 3 Previous Solutions options describing existing approaches and their limitations.`,
    guidedFields: [
      {
        key: 'existing_methods',
        label: 'Existing Methods / Technologies',
        placeholder: 'e.g., IVR systems, caller-ID, customer forms, sentiment analysis...',
        type: 'textarea',
      },
      {
        key: 'limitations',
        label: 'Key Limitations',
        placeholder: 'e.g., Relies on self-reporting, reactive not proactive, indirect detection...',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'previous_solutions')}
Existing methods: ${fields['existing_methods'] || ''}
Limitations: ${fields['limitations'] || ''}

Generate 3 Previous Solutions options.`,
  },

  differences: {
    label: 'Key Differences',
    description: 'Explain what makes this invention novel',
    systemContext: `You are a patent analyst writing the Differences with Previous Solutions section of an IDF.
Generate 3 options. Each must:
- Clearly articulate how this invention differs from prior approaches
- Highlight novel technical elements or methods
- Explain why these differences matter (the advantage they confer)
- Be 2–3 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'differences')}

Generate 3 options explaining how this invention differs from previous solutions.`,
    guidedFields: [
      {
        key: 'novel_elements',
        label: 'Novel Technical Elements',
        placeholder: 'e.g., Real-time facial expression recognition using ONNX models...',
        type: 'textarea',
      },
      {
        key: 'advantage',
        label: 'Key Advantage Over Prior Art',
        placeholder: 'e.g., Proactive emotional state detection before call connection...',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'differences')}
Novel elements: ${fields['novel_elements'] || ''}
Key advantage: ${fields['advantage'] || ''}

Generate 3 Differences with Previous Solutions options.`,
  },

  invention_summary: {
    label: 'Invention Summary',
    description: 'High-level overview of the invention',
    systemContext: `You are a patent analyst writing the Invention Summary section of an IDF.
Generate 3 options. Each must:
- Describe the invention at a high level using accessible language
- Reference key technologies or standards used (e.g., ONNX, FER, etc.)
- Include market context or scale if relevant
- Be 2–4 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'invention_summary')}

Generate 3 Invention Summary options.`,
    guidedFields: [
      {
        key: 'core_method',
        label: 'Core Method / Technology',
        placeholder: 'e.g., Facial Expression Recognition via ONNX deep learning models...',
        type: 'textarea',
      },
      {
        key: 'market_context',
        label: 'Market Context (optional)',
        placeholder: 'e.g., Emotion recognition market projected at $91B by 2024...',
        type: 'text',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'invention_summary')}
Core method: ${fields['core_method'] || ''}
Market context: ${fields['market_context'] || ''}

Generate 3 Invention Summary options.`,
  },

  variations: {
    label: 'Possible Variations',
    description: 'Alternative implementations and embodiments',
    systemContext: `You are a patent analyst writing the Possible Variations section of an IDF.
Generate 3 options. Each must:
- Describe alternative implementations or embodiments of the invention
- Include variations that broaden patent scope
- Suggest adjacent use cases or deployment scenarios
- Be 2–3 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'variations')}

Generate 3 Possible Variations options for this invention.`,
    guidedFields: [
      {
        key: 'alt_implementations',
        label: 'Alternative Implementations',
        placeholder: 'e.g., Wearable devices, smart watch integration, server-side processing...',
        type: 'textarea',
      },
      {
        key: 'embodiments',
        label: 'Embodiment Variations',
        placeholder: 'e.g., Real-time vs batch processing, single-user vs multi-user...',
        type: 'text',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'variations')}
Alternative implementations: ${fields['alt_implementations'] || ''}
Embodiment variations: ${fields['embodiments'] || ''}

Generate 3 Possible Variations options.`,
  },

  other_applications: {
    label: 'Other Applications',
    description: 'Additional use cases beyond the primary application',
    systemContext: `You are a patent analyst writing the Other Applications section of an IDF.
Generate 3 options. Each must:
- Identify other industries or domains where the invention could be applied
- Be specific about how the technology transfers to each context
- Be 2–3 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'other_applications')}

Generate 3 Other Applications options for this invention.`,
    guidedFields: [
      {
        key: 'industries',
        label: 'Target Industries / Domains',
        placeholder: 'e.g., Healthcare diagnostics, autonomous vehicles, retail analytics...',
        type: 'textarea',
      },
      {
        key: 'use_cases',
        label: 'Specific Use Cases',
        placeholder: 'e.g., Detecting driver fatigue, measuring crowd mood in retail...',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'other_applications')}
Industries: ${fields['industries'] || ''}
Use cases: ${fields['use_cases'] || ''}

Generate 3 Other Applications options.`,
  },

  full_description: {
    label: 'Full Description',
    description: 'Complete technical description of the invention',
    systemContext: `You are a patent attorney writing the Full Description section of an IDF.
Generate 3 options. Each must:
- Provide a complete technical description enabling a person skilled in the art to practice the invention
- Include background context, the core method, and implementation details
- Reference figures where appropriate (e.g., "Figure 1 illustrates...")
- Be 4–6 paragraphs${THREE_OPTIONS_FORMAT}`,
    buildPrompt: (artifact) =>
      `${buildArtifactContext(artifact, 'full_description')}

Generate 3 Full Description options with complete technical detail.`,
    guidedFields: [
      {
        key: 'components',
        label: 'Key Technical Components',
        placeholder: 'e.g., Camera module, ONNX inference engine, FER classification layer, call router...',
        type: 'textarea',
      },
      {
        key: 'process_flow',
        label: 'Process / Data Flow',
        placeholder: 'e.g., Capture → Pre-process → Keypoint detection → FER → Classification → Route...',
        type: 'textarea',
      },
    ],
    buildGuidedPrompt: (artifact, fields) =>
      `${buildArtifactContext(artifact, 'full_description')}
Key components: ${fields['components'] || ''}
Process flow: ${fields['process_flow'] || ''}

Generate 3 Full Description options.`,
  },
};
