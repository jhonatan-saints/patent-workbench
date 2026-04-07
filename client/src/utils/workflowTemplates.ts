import type { PatentArtifact } from '@/types';
import templates from '@/config/reg-templates.json';

export interface GuidedField {
  key: string;
  label: string;
  placeholder: string;
  labelKey: string;
  placeholderKey: string;
  type: 'text' | 'textarea';
}

export interface WorkflowModule {
  label: string;
  description: string;
  systemContext: (numOptions: number) => string;
  buildPrompt: (artifact: PatentArtifact, numOptions: number) => string;
  guidedFields: GuidedField[];
  buildGuidedPrompt: (
    artifact: PatentArtifact,
    fields: Record<string, string>,
    numOptions: number,
  ) => string;
}

const RAG = templates.rag;

// Internal helpers

function buildOptionsFormat(n: number): string {
  const header = `\n\nReturn EXACTLY ${n} distinct option${n === 1 ? '' : 's'}. Use this format with no other text:\n`;
  const blocks = Array.from({ length: n }, (_, i) => `OPTION ${i + 1}:\n[content]`).join('\n\n');
  return header + '\n' + blocks;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/**
 * Replaces all supported placeholders in a template string:
 * - {{numOptions}} → the number of options
 * - {{plural}}     → "" when numOptions === 1, "s" otherwise
 * - {{fields.KEY}} → value of guided field KEY (truncated to maxSectionChars)
 */
function applyPlaceholders(
  template: string,
  numOptions: number,
  fields?: Record<string, string>,
): string {
  let result = template
    .replaceAll('{{numOptions}}', String(numOptions))
    .replaceAll('{{plural}}', numOptions === 1 ? '' : 's');

  if (fields) {
    result = result.replaceAll(/\{\{fields\.(\w+)\}\}/g, (_, key: string) =>
      truncate(fields[key] ?? '', RAG.maxSectionChars),
    );
  }

  return result;
}

// RAG context builder

// EN labels used when injecting prior sections into the prompt context.
const SECTION_LABELS_EN: Record<string, string> = Object.fromEntries(
  Object.entries(templates.steps).map(([id, step]) => [id, step.sectionLabelEn]),
);

export function buildArtifactContext(artifact: PatentArtifact, upToModule?: string): string {
  const stopIdx = upToModule ? WORKFLOW_ORDER.indexOf(upToModule) : WORKFLOW_ORDER.length;

  const lines: string[] = [];
  lines.push(`Invention: ${truncate(artifact.baseIdea, RAG.maxIdeaChars)}`);
  if (artifact.baseDomain) lines.push(`Domain: ${artifact.baseDomain}`);
  if (artifact.constraints) lines.push(`Notes: ${truncate(artifact.constraints, RAG.maxConstraintsChars)}`);
  if (artifact.inventors.length > 0) {
    lines.push(`Inventor(s): ${artifact.inventors.map((inv) => inv.name).join(', ')}`);
  }

  const priorModules = WORKFLOW_ORDER.slice(0, stopIdx)
    .filter((m) => artifact.sections[m])
    .slice(-RAG.maxPriorSections);

  if (priorModules.length > 0) {
    lines.push('', 'Prior sections:');
    for (const m of priorModules) {
      const section = artifact.sections[m]!;
      const label = SECTION_LABELS_EN[m] ?? m;
      lines.push(`[${label}] ${truncate(section.content, RAG.maxSectionChars)}`);
    }
  }

  if (artifact.contextFiles?.length) {
    lines.push('', 'Reference documents:');
    let remaining = RAG.maxContextFileChars;
    for (const file of artifact.contextFiles) {
      if (remaining <= 0) break;
      const content = file.content.slice(0, remaining);
      lines.push(`[${file.name}]\n${content}`);
      remaining -= content.length;
    }
  }

  return lines.join('\n');
}

// Derived exports (consumed by store + components)

// Ordered list of step IDs — driven by workflow.order in reg-templates.json.
export const WORKFLOW_ORDER: string[] = templates.workflow.order;

// Internal maps — consumed only by resolveLabel / resolveDescription below.
const MODULE_RESOURCE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(templates.steps).map(([id, step]) => [id, step.labelKey ?? step.label]),
);

const MODULE_DESCRIPTION_RESOURCE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(templates.steps).map(([id, step]) => [id, step.descriptionKey ?? step.description]),
);

/**
 * Resolves the display label for a step.
 * - If the key starts with "res_" it is passed through t() for translation.
 * - Otherwise the key is used as a literal string (single-language templates).
 * - Falls back to the raw moduleId if no key is configured.
 */
export function resolveLabel(moduleId: string, t: (key: string) => string): string {
  const key = MODULE_RESOURCE_KEYS[moduleId];
  if (!key) return moduleId;
  return key.startsWith('res_') ? t(key) : key;
}

export function resolveDescription(moduleId: string, t: (key: string) => string): string {
  const key = MODULE_DESCRIPTION_RESOURCE_KEYS[moduleId];
  if (!key) return moduleId;
  return key.startsWith('res_') ? t(key) : key;
}

// Workflow modules (derived from JSON)

export const WORKFLOW_MODULES: Record<string, WorkflowModule> = Object.fromEntries(
  Object.entries(templates.steps).map(([id, step]) => [
    id,
    {
      label: step.label,
      description: step.description,

      // System prompt: JSON provides role + requirements; engine appends the
      // dynamic "OPTION 1 / OPTION 2 / ..." format block.
      systemContext: (numOptions: number) =>
        applyPlaceholders(step.systemContext, numOptions) + buildOptionsFormat(numOptions),

      // Auto mode: RAG context prefix + prompt suffix from JSON.
      buildPrompt: (artifact: PatentArtifact, numOptions: number) =>
        `${buildArtifactContext(artifact, id)}\n\n${applyPlaceholders(step.promptSuffix, numOptions)}`,

      guidedFields: (step.guidedFields ?? []) as GuidedField[],

      // Guided mode: RAG context prefix + guided prompt suffix from JSON.
      buildGuidedPrompt: (
        artifact: PatentArtifact,
        fields: Record<string, string>,
        numOptions: number,
      ) =>
        `${buildArtifactContext(artifact, id)}\n\n${applyPlaceholders(step.guidedPromptSuffix, numOptions, fields)}`,
    } satisfies WorkflowModule,
  ]),
);
