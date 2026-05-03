import type { PatentArtifact, RegTemplate } from '@/types';
import bundledTemplates from '@templates/reg-templates.json';

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

// Mutable module-level state — updated by reinitFromTemplate() after the
// live template is loaded from the API. Components hold references to these
// objects, so in-place mutation propagates without requiring component changes.
let RAG = bundledTemplates.rag;

// Internal helpers

function buildOptionsFormat(n: number): string {
  const header = `\n\nReturn EXACTLY ${n} distinct option${n === 1 ? '' : 's'}. Use this format with no other text:\n`;
  const blocks = Array.from({ length: n }, (_, i) => `OPTION ${i + 1}:`).join('\n\n');
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

// Mutable internal maps — updated in-place by reinitFromTemplate().
// Components hold references to these objects so mutations are visible
// without requiring any import changes in consumers.
const bundledSteps = bundledTemplates.steps as RegTemplate['steps'];

let SECTION_LABELS_EN: Record<string, string> = Object.fromEntries(
  Object.entries(bundledSteps).map(([id, step]) => [id, step.sectionLabelEn ?? id]),
);

const MODULE_RESOURCE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(bundledSteps).map(([id, step]) => [id, step.labelKey ?? step.label]),
);

const MODULE_DESCRIPTION_RESOURCE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(bundledSteps).map(([id, step]) => [id, step.descriptionKey ?? step.description ?? id]),
);

// RAG context builder

type ScoredSection = { moduleId: string; position_j: number; content: string; score: number };

function selectPriorSections(artifact: PatentArtifact, stepIdx: number): ScoredSection[] {
  const perSourceBudget = RAG.maxSectionChars;
  const stepBudget = RAG.maxPriorSections * perSourceBudget;

  // s_j = w(position_j, i) × min(|c_j|, perSourceBudget)
  // w(position_j, i) = (maxPriorSections − (i − position_j − 1)) / maxPriorSections
  const scored = WORKFLOW_ORDER.slice(0, stepIdx)
    .map((moduleId, position_j): ScoredSection | null => {
      const section = artifact.sections[moduleId];
      if (!section) return null;
      const w = (RAG.maxPriorSections - (stepIdx - position_j - 1)) / RAG.maxPriorSections;
      if (w <= 0) return null;
      const boundedLen = Math.min(section.content.length, perSourceBudget);
      return { moduleId, position_j, content: section.content, score: w * boundedLen };
    })
    .filter((c): c is ScoredSection => c !== null)
    .sort((a, b) => b.score - a.score);

  // Bounded Context Injector: accumulate until step budget exhausted
  let accumulated = 0;
  const selected: ScoredSection[] = [];
  for (const candidate of scored) {
    const chars = Math.min(candidate.content.length, perSourceBudget);
    if (accumulated + chars > stepBudget) break;
    selected.push(candidate);
    accumulated += chars;
  }

  return selected.sort((a, b) => a.position_j - b.position_j); // restore document order
}

function buildContextFileLines(artifact: PatentArtifact): string[] {
  if (!artifact.contextFiles?.length) return [];
  const lines: string[] = ['', 'Reference documents:'];
  let remaining = RAG.maxContextFileChars;
  for (const file of artifact.contextFiles) {
    if (remaining <= 0) break;
    const content = file.content.slice(0, remaining);
    lines.push(`[${file.name}]\n${content}`);
    remaining -= content.length;
  }
  return lines;
}

export function buildArtifactContext(artifact: PatentArtifact, upToModule?: string): string {
  const stopIdx = upToModule ? WORKFLOW_ORDER.indexOf(upToModule) : WORKFLOW_ORDER.length;

  const lines: string[] = [];
  lines.push(`Invention: ${truncate(artifact.baseIdea, RAG.maxIdeaChars)}`);
  if (artifact.baseDomain) lines.push(`Domain: ${artifact.baseDomain}`);
  if (artifact.constraints) lines.push(`Notes: ${truncate(artifact.constraints, RAG.maxConstraintsChars)}`);
  if (artifact.inventors.length > 0) {
    lines.push(`Inventor(s): ${artifact.inventors.map((inv) => inv.name).join(', ')}`);
  }

  // D-3: step 0 has no prior sections — Because of that we skip context selection entirely
  if (stopIdx > 0) {
    const selected = selectPriorSections(artifact, stopIdx);
    if (selected.length > 0) {
      lines.push('', 'Prior sections:');
      for (const { moduleId, content } of selected) {
        const label = SECTION_LABELS_EN[moduleId] ?? moduleId;
        lines.push(`[${label}] ${truncate(content, RAG.maxSectionChars)}`);
      }
    }
  }

  lines.push(...buildContextFileLines(artifact));

  return lines.join('\n');
}

// Derived exports (consumed by store + components)

// Mutable arrays/objects — mutated in-place by reinitFromTemplate() so that
// all existing consumer references pick up the live template without changes.
export const WORKFLOW_ORDER: string[] = [...bundledTemplates.workflow.order];

export const WORKFLOW_MODULES: Record<string, WorkflowModule> = buildModulesFromSteps(
  bundledTemplates.steps as RegTemplate['steps'],
);

function buildModulesFromSteps(
  steps: RegTemplate['steps'],
): Record<string, WorkflowModule> {
  return Object.fromEntries(
    Object.entries(steps).map(([id, step]) => [
      id,
      {
        label: step.label,
        description: step.description ?? '',
        systemContext: (numOptions: number) =>
          applyPlaceholders(step.systemContext, numOptions) + buildOptionsFormat(numOptions),
        buildPrompt: (artifact: PatentArtifact, numOptions: number) =>
          `${buildArtifactContext(artifact, id)}\n\n${applyPlaceholders(step.promptSuffix ?? '', numOptions)}`,
        guidedFields: (step.guidedFields ?? []) as GuidedField[],
        buildGuidedPrompt: (
          artifact: PatentArtifact,
          fields: Record<string, string>,
          numOptions: number,
        ) =>
          `${buildArtifactContext(artifact, id)}\n\n${applyPlaceholders(step.guidedPromptSuffix ?? '', numOptions, fields)}`,
      } satisfies WorkflowModule,
    ]),
  );
}

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

/**
 * Reinitialises all module-level exports from a live template fetched from
 * the API. Mutates in-place so that existing consumer references remain valid.
 * Called by the store after loadTemplate() resolves.
 */
export function reinitFromTemplate(t: RegTemplate): void {
  if (t.rag) RAG = t.rag;

  WORKFLOW_ORDER.splice(0, Infinity, ...t.workflow.order);

  SECTION_LABELS_EN = Object.fromEntries(
    Object.entries(t.steps).map(([id, step]) => [id, step.sectionLabelEn ?? id]),
  );

  const newKeys = Object.fromEntries(
    Object.entries(t.steps).map(([id, step]) => [id, step.labelKey ?? step.label]),
  );
  const newDescKeys = Object.fromEntries(
    Object.entries(t.steps).map(([id, step]) => [id, step.descriptionKey ?? step.description ?? id]),
  );
  Object.keys(MODULE_RESOURCE_KEYS).forEach((k) => delete MODULE_RESOURCE_KEYS[k]);
  Object.assign(MODULE_RESOURCE_KEYS, newKeys);
  Object.keys(MODULE_DESCRIPTION_RESOURCE_KEYS).forEach((k) => delete MODULE_DESCRIPTION_RESOURCE_KEYS[k]);
  Object.assign(MODULE_DESCRIPTION_RESOURCE_KEYS, newDescKeys);

  const newModules = buildModulesFromSteps(t.steps);
  Object.keys(WORKFLOW_MODULES).forEach((k) => delete WORKFLOW_MODULES[k]);
  Object.assign(WORKFLOW_MODULES, newModules);
}
