import { create } from 'zustand';
import type {
  WorkbenchState,
  PatentArtifact,
  WorkflowSession,
  GeneratedOption,
  AppSettings,
  RegTemplate,
  StepStatus,
  IdfReviewFinding,
  IdfReviewResult,
  RegTemplateReviewPass,
} from '@/types';
import {
  streamPatentContent,
  getModels,
  getStatus,
  getModelContextLength,
  isApiError,
  fetchSessions,
  getSession,
  saveSession,
  deleteSession as apiDeleteSession,
  clearAllSessions,
  getSettings,
  updateSettings as apiUpdateSettings,
  resetSettings as apiResetSettings,
  getTemplate,
  updateTemplate as apiUpdateTemplate,
  resetTemplate as apiResetTemplate,
  setApiKey,
} from '@/api/client';
import { sanitizeOutput, generateId } from '@/utils/sanitize';
import { WORKFLOW_MODULES, WORKFLOW_ORDER, reinitFromTemplate } from '@/utils/workflowTemplates';
import { parseOptions } from '@/utils/optionParser';
import bundledTemplates from '@templates/reg-templates.json';

const DEFAULT_MODEL = (import.meta.env.VITE_DEFAULT_MODEL as string | undefined) || 'qwen2.5:7b';
const DEFAULT_LLM_TIMEOUT_MS = Number(import.meta.env.VITE_LLM_TIMEOUT_MS) || 300_000;
const DEFAULT_NUM_OPTIONS = Number(import.meta.env.VITE_NUM_OPTIONS) || 3;

// Client-side defaults used only until loadSettings() resolves on app mount.
// Values that matter before server responds (model, timeout, numOptions) come from VITE_ env vars
// so they stay in sync with server/.env without hardcoding.
// Server-only fields (ollamaUrl, promptMaxLength, shutdownTimeoutMs, logLevel) use sensible
// placeholders — they're overwritten by the server response before any user action.
const DEFAULT_SETTINGS: AppSettings = {
  defaultModel: DEFAULT_MODEL,
  llmTimeoutMs: DEFAULT_LLM_TIMEOUT_MS,
  numOptions: DEFAULT_NUM_OPTIONS,
  ollamaUrl: 'http://localhost:11434',
  promptMaxLength: 16_000,
  shutdownTimeoutMs: 3_600_000,
  logLevel: 'info',
};

// Module-level abort controllers — not in Zustand state to avoid re-renders
let _abortController: AbortController | null = null;
let _reviewAbortController: AbortController | null = null;

function parseStreamingOptions(text: string): string[] {
  const re = /OPTION\s+\d+\s*:\s*\n?([\s\S]*?)(?=OPTION\s+\d+\s*:|$)/gi;
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const content = match[1].replace(/^\[content\]\s*/i, '').trimStart();
    results.push(content);
  }
  return results;
}

function emptyOptionsByMode() {
  return { auto: [] as GeneratedOption[], guided: [] as GeneratedOption[] };
}

function getInitialSteps() {
  return WORKFLOW_ORDER.map((moduleId) => ({
    moduleId,
    label: WORKFLOW_MODULES[moduleId].label,
    description: WORKFLOW_MODULES[moduleId].description,
    status: 'pending' as const,
    optionsByMode: emptyOptionsByMode(),
    selectedOption: null,
    promptTokens: 0,
    completionTokens: 0,
    inputMode: 'auto' as const,
    guidedFields: {} as Record<string, string>,
    manualDraft: '',
  }));
}

// Sections that matter most for patentability get higher budget and score weight.
const SECTION_BUDGET_WEIGHTS: Record<string, number> = {
  full_description: 1.5,
  key_differences: 1.4,
  invention_summary: 1.2,
  previous_solutions: 1.1,
  problem: 1,
  variations: 0.8,
  other_applications: 0.7,
};

const SECTION_SCORE_WEIGHTS: Record<string, number> = {
  ...SECTION_BUDGET_WEIGHTS,
  global: 1.2,
};

// Score base of 7: clean doc is solid but not exceptional. Section weight multiplies
// each penalty/bonus so a critical in full_description hurts more than in other_applications.
function computeReviewScore(findings: IdfReviewFinding[]): number {
  let criticalPenalty = 0;
  let warningPenalty = 0;
  let strengthBonus = 0;
  let hasCritical = false;

  for (const f of findings) {
    const w = SECTION_SCORE_WEIGHTS[f.section] ?? 1;
    if (f.severity === 'critical') { criticalPenalty += 2 * w; hasCritical = true; }
    else if (f.severity === 'warning') warningPenalty += 0.75 * w;
    else if (f.severity === 'strength') strengthBonus += 0.5 * w;
  }

  let score = 7 - criticalPenalty - warningPenalty + strengthBonus;
  if (hasCritical) score = Math.min(score, 5);
  return Math.min(10, Math.max(1, Math.round(score)));
}

// Deterministic structural checks that run before any LLM call — catches thin sections
// without consuming model tokens.
function runDeterministicChecks(
  artifact: PatentArtifact,
  presentSections: string[],
): IdfReviewFinding[] {
  const results: IdfReviewFinding[] = [];

  for (const id of presentSections) {
    if ((artifact.sections[id]?.content ?? '').trim().length < 200) {
      results.push({
        severity: 'warning',
        section: id,
        title: 'Section too short',
        detail: 'Section has fewer than 200 characters and likely lacks sufficient technical depth for patent enablement.',
      });
    }
  }

  return results;
}

// Review helpers

interface ReviewCtx {
  selectedModel: string;
  signal: AbortSignal;
  timeoutMs: number;
  sectionListHint: string;
  priorContext: string;
  docText: string;
  fullDocText: string;
  documentSnapshot: string;
  changedSections: string[];
  reusedFindings: IdfReviewFinding[];
}

type ReviewOutcome =
  | { type: 'success'; result: IdfReviewResult }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

function reviewErrorOutcome(error: string): ReviewOutcome {
  return error === 'Generation cancelled.'
    ? { type: 'cancelled' }
    : { type: 'error', message: error };
}

function buildDocSnapshot(artifact: PatentArtifact): string {
  return Object.entries(artifact.sections)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, s]) => s?.content ?? '')
    .join('\0');
}

function buildDocText(artifact: PatentArtifact, presentSections: string[], maxChars: number): string {
  const totalWeight = presentSections.reduce((sum, id) => sum + (SECTION_BUDGET_WEIGHTS[id] ?? 1), 0);
  return presentSections
    .map((id) => {
      const budget = Math.floor((maxChars * (SECTION_BUDGET_WEIGHTS[id] ?? 1)) / totalWeight);
      return `[${id.toUpperCase()}]\n${artifact.sections[id]!.content.slice(0, budget)}`;
    })
    .join('\n\n');
}

function buildSectionHint(presentSections: string[]): string {
  return (
    `Valid section identifiers for the "section" field: ${presentSections.join(', ')}, global.\n` +
    `Each finding's "section" field MUST be one of these exact strings.\n` +
    `Valid severity values: "critical", "warning", "suggestion", "strength".`
  );
}

function buildPriorContext(artifact: PatentArtifact, previousResult: IdfReviewResult | null): string {
  if (!previousResult) return '';
  const sortedKeys = Object.keys(artifact.sections).sort((a, b) => a.localeCompare(b));
  const prevContents = previousResult.documentSnapshot.split('\0');
  const changedSections = sortedKeys.filter(
    (id, i) => (artifact.sections[id]?.content ?? '') !== (prevContents[i] ?? '')
  );
  const changedList = changedSections.length > 0 ? changedSections.join(', ') : 'none';
  const findingLines = previousResult.findings
    .map((f, i) => `  ${i + 1}. [${f.severity.toUpperCase()}] ${f.section} — ${f.title}: ${f.detail}`)
    .join('\n');
  return (
    `\n\nPREVIOUS REVIEW (score ${previousResult.overallScore}/10):\n` +
    `${previousResult.summary}\n\n` +
    `Changed sections since last review: ${changedList}.\n\n` +
    `Previous findings:\n${findingLines}\n\n` +
    `INSTRUCTIONS: Verify whether each previous finding was addressed. ` +
    `Omit resolved findings, keep unresolved ones with updated detail, add any new issues found. ` +
    `In the synthesis summary state how many previous findings were resolved vs. still open.`
  );
}

function parseAnalysisFindings(text: string): IdfReviewFinding[] {
  const m = /\[[\s\S]*\]/.exec(text);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]) as unknown;
    return Array.isArray(parsed) ? (parsed as IdfReviewFinding[]) : [];
  } catch {
    return [];
  }
}

function parseSynthesisSummary(text: string): string | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]) as { summary?: string };
    return parsed.summary ?? null;
  } catch {
    return null;
  }
}

type PassResult = { findings: IdfReviewFinding[] } | { error: string } | null;

function filterHallucinatedQuotes(findings: IdfReviewFinding[], fullDocText: string): IdfReviewFinding[] {
  const normalizedDoc = fullDocText.replaceAll(/\s+/g, ' ').toLowerCase();
  return findings.filter((f) => {
    if (!f.quote || f.quote.trim().length === 0) return true;
    return normalizedDoc.includes(f.quote.replaceAll(/\s+/g, ' ').trim().toLowerCase());
  });
}

// Detects findings that falsely claim a named term is absent from the document.
// Extracts single-quoted / backtick terms from the finding text, then checks whether
// each term actually appears in a definition context (X = …, (ACRONYM), where X is …).
// If the term is provably defined, the "undefined / missing" claim is contradicted → suppress.

const ABSENT_CLAIM_RE =
  /\b(undefined|missing|absent|lacks?|omitted?|not\s+(defined|specified|provided|included)|never\s+defined)\b/i;

function extractClaimedMissingTerms(finding: IdfReviewFinding): string[] {
  const text = `${finding.title} ${finding.detail}`;
  const terms = new Set<string>();
  const singleQuoteRe = /'([^']{1,100})'/g;
  let m: RegExpExecArray | null;
  while ((m = singleQuoteRe.exec(text)) !== null) terms.add(m[1].trim());
  const backtickRe = /`([^`]{1,100})`/g;
  while ((m = backtickRe.exec(text)) !== null) terms.add(m[1].trim());
  return [...terms].filter((t) => t.length > 0);
}

function termIsDefinedInDocument(term: string, normalizedDoc: string): boolean {
  const esc = term
    .replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    .replaceAll(/\s+/g, String.raw`\s+`);
  const patterns = [
    new RegExp(String.raw`${esc}\s*=\s*\S`, 'i'),       // term = value
    new RegExp(String.raw`\(\s*${esc}\s*\)`, 'i'),      // (ACRONYM) expansion
    new RegExp(String.raw`where\s+${esc}\s+is\b`, 'i'),  // where term is ...
    new RegExp(String.raw`${esc}\s+is\s+defined\b`, 'i'),
    new RegExp(String.raw`${esc}\s*[—–]\s*\w`, 'i'),     // term — definition
    new RegExp(String.raw`${esc}\s*:\s*[A-Z]`, 'i'),      // Term: Definition
  ];
  return patterns.some((p) => p.test(normalizedDoc));
}

function filterUndefinedHallucinations(
  findings: IdfReviewFinding[],
  fullDocText: string,
): IdfReviewFinding[] {
  const normalizedDoc = fullDocText.replaceAll(/\s+/g, ' ');
  return findings.filter((f) => {
    if (f.severity === 'strength') return true;
    if (!ABSENT_CLAIM_RE.test(`${f.title} ${f.detail}`)) return true;
    const terms = extractClaimedMissingTerms(f);
    if (terms.length === 0) return true;
    return !terms.some((t) => termIsDefinedInDocument(t, normalizedDoc));
  });
}

function filterLLMFindings(findings: IdfReviewFinding[], fullDocText: string): IdfReviewFinding[] {
  return filterUndefinedHallucinations(filterHallucinatedQuotes(findings, fullDocText), fullDocText);
}

function deduplicateFindings(findings: IdfReviewFinding[]): IdfReviewFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.section}:${f.title.toLowerCase().replaceAll(/\s+/g, ' ').trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyConfidenceDowngrade(findings: IdfReviewFinding[]): IdfReviewFinding[] {
  return findings.map((f) =>
    f.confidence !== undefined && f.confidence < 0.5 && f.severity !== 'strength'
      ? { ...f, severity: 'suggestion' as const }
      : f
  );
}

function computeIncrementalState(
  artifact: PatentArtifact,
  presentSections: string[],
  previousResult: IdfReviewResult | null,
): [string[], IdfReviewFinding[]] {
  if (!previousResult) return [presentSections, []];
  const sortedKeys = presentSections.slice().sort((a, b) => a.localeCompare(b));
  const prevContents = previousResult.documentSnapshot.split('\0');
  const changedSections = sortedKeys.filter(
    (id, i) => (artifact.sections[id]?.content ?? '') !== (prevContents[i] ?? '')
  );
  const unchangedSet = new Set(sortedKeys.filter(id => !changedSections.includes(id)));
  const reusedFindings = previousResult.findings.filter(
    f => f.section !== 'global' && unchangedSet.has(f.section)
  );
  return [changedSections, reusedFindings];
}


function mergePassFindings(results: PassResult[]): IdfReviewFinding[] {
  return results.flatMap(r => r && 'findings' in r ? r.findings : []);
}

async function runMultiPass(
  passes: RegTemplateReviewPass[],
  deterministicFindings: IdfReviewFinding[],
  ctx: ReviewCtx,
  setPass: (label: string | null) => void,
): Promise<ReviewOutcome> {
  const analysisPasses = passes.slice(0, -1);
  const synthesisPass = passes[passes.length - 1];
  const allFindings: IdfReviewFinding[] = [
    ...deterministicFindings,
    ...filterLLMFindings(ctx.reusedFindings, ctx.fullDocText),
  ];
  const focusHint = ctx.reusedFindings.length > 0
    ? `\n\nFOCUS ONLY ON SECTIONS: ${ctx.changedSections.join(', ')}. Findings for unchanged sections are pre-loaded.`
    : '';

  const passOutcomes: PassResult[] = [];
  for (const pass of analysisPasses) {
    if (ctx.signal.aborted) return { type: 'cancelled' };
    setPass(pass.labelKey ?? pass.label);
    const system = `${pass.systemContext}\n\n${ctx.sectionListHint}${focusHint}${ctx.priorContext}\n\nIDF DOCUMENT:\n${ctx.docText}`;
    let fullText = '';
    const result = await streamPatentContent(
      { prompt: 'Return the JSON findings array now.', system, model: ctx.selectedModel, temperature: pass.temperature },
      (chunk) => { fullText += chunk; },
      ctx.signal,
      ctx.timeoutMs,
    );
    if (isApiError(result)) return reviewErrorOutcome(result.error);
    passOutcomes.push({ findings: filterLLMFindings(parseAnalysisFindings(fullText), ctx.fullDocText) });
  }

  if (ctx.signal.aborted) return { type: 'cancelled' };

  allFindings.push(...mergePassFindings(passOutcomes));
  const merged = applyConfidenceDowngrade(deduplicateFindings(allFindings));

  if (ctx.signal.aborted) return { type: 'cancelled' };

  setPass(synthesisPass.labelKey ?? synthesisPass.id);
  const synthesisSystem = `${synthesisPass.systemContext}\n\nFINDINGS:\n${JSON.stringify(merged, null, 2)}`;
  let synthesisText = '';
  const synthesisResult = await streamPatentContent(
    { prompt: 'Return the JSON summary object now.', system: synthesisSystem, model: ctx.selectedModel, temperature: synthesisPass.temperature },
    (chunk) => { synthesisText += chunk; },
    ctx.signal,
    ctx.timeoutMs,
  );

  if (isApiError(synthesisResult)) return reviewErrorOutcome(synthesisResult.error);

  const summary = parseSynthesisSummary(synthesisText);
  if (summary === null) return { type: 'error', message: 'Failed to parse synthesis response.' };

  return {
    type: 'success',
    result: {
      overallScore: computeReviewScore(merged),
      summary,
      findings: merged,
      generatedAt: Date.now(),
      documentSnapshot: ctx.documentSnapshot,
    },
  };
}

async function runSinglePass(
  systemContext: string,
  deterministicFindings: IdfReviewFinding[],
  ctx: ReviewCtx,
): Promise<ReviewOutcome> {
  const system = `${systemContext}\n\n${ctx.sectionListHint}${ctx.priorContext}\n\nIDF DOCUMENT:\n${ctx.docText}`;
  let fullText = '';
  const result = await streamPatentContent(
    { prompt: 'Return the JSON review object now.', system, model: ctx.selectedModel },
    (chunk) => { fullText += chunk; },
    ctx.signal,
    ctx.timeoutMs,
  );

  if (isApiError(result)) return reviewErrorOutcome(result.error);

  try {
    const m = /\{[\s\S]*\}/.exec(fullText);
    if (!m) return { type: 'error', message: 'Failed to parse review response.' };
    const parsed = JSON.parse(m[0]) as { summary?: string; findings?: unknown[] };
    const llmFindings = Array.isArray(parsed.findings)
      ? filterLLMFindings(parsed.findings as IdfReviewFinding[], ctx.fullDocText)
      : [];
    const findings = [...deterministicFindings, ...llmFindings];
    return {
      type: 'success',
      result: {
        overallScore: computeReviewScore(findings),
        summary: parsed.summary ?? '',
        findings,
        generatedAt: Date.now(),
        documentSnapshot: ctx.documentSnapshot,
      },
    };
  } catch {
    return { type: 'error', message: 'Failed to parse review response.' };
  }
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  // LLM — selectedModel bootstrapped from VITE_DEFAULT_MODEL until loadSettings() resolves
  selectedModel: DEFAULT_MODEL,
  availableModels: [],
  modelContextLength: null,
  llmStatus: 'checking',
  llmLatency: null,

  // Workflow
  workflowPhase: 'input',
  steps: getInitialSteps(),
  currentStepIndex: -1,
  artifact: null,
  generationStatus: 'idle',
  lastError: null,
  streamingOptions: [],

  // IDF Review
  reviewResult: null,
  reviewStatus: 'idle' as const,
  reviewPass: null,

  // Sessions
  sessions: [],

  // Figures workspace drafts
  figuresDraft: { diagramNodes: [], diagramEdges: [], jsonText: '' },

  // Diagram AI generation lock
  diagramGenerating: false,
  setDiagramGenerating: (v) => set({ diagramGenerating: v }),

  // Cascade update
  pendingCascadeFromStep: null,
  dismissCascade: () => set({ pendingCascadeFromStep: null }),
  cascadeRegenerateDownstream: async () => {
    const { steps, pendingCascadeFromStep } = get();
    if (pendingCascadeFromStep === null) return;
    set({ pendingCascadeFromStep: null });
    // Iterate downstream steps that have a selectedOption and auto-regenerate + auto-select
    for (let i = pendingCascadeFromStep + 1; i < steps.length; i++) {
      if (!steps[i].selectedOption) continue;
      set({ currentStepIndex: i });
      // force auto mode for cascade
      set((state) => ({
        steps: state.steps.map((s, idx) =>
          idx === i ? { ...s, inputMode: 'auto' as const } : s
        ),
      }));
      await get().generateStepOptions();
      const { steps: updated } = get();
      const first = updated[i].optionsByMode.auto[0];
      if (first) get().selectOption(first);
    }
  },

  // App settings
  appSettings: DEFAULT_SETTINGS,

  // Workflow template (bundled JSON as initial value; overwritten by loadTemplate on boot)
  template: bundledTemplates as unknown as RegTemplate,

  // Actions

  setModel: (model) => {
    set({ selectedModel: model });
    get().fetchModelContextLength(model);
  },

  fetchModelContextLength: async (model) => {
    const contextLength = await getModelContextLength(model);
    set({ modelContextLength: contextLength });
  },

  checkStatus: async () => {
    const [status, models] = await Promise.all([getStatus(), getModels()]);
    set((state) => {
      const next: Partial<typeof state> = {};

      if (status.llm !== state.llmStatus) next.llmStatus = status.llm;
      if (status.latency !== state.llmLatency) next.llmLatency = status.latency;

      if (models.length > 0) {
        const modelsChanged = models.join(',') !== state.availableModels.join(',');
        if (modelsChanged) next.availableModels = models;

        const best =
          models.find((m) => m.split(':')[0] === state.selectedModel.split(':')[0]) ?? models[0];
        if (best !== state.selectedModel) next.selectedModel = best;
      }

      if (next.selectedModel) get().fetchModelContextLength(next.selectedModel);
      return next;
    });
  },

  startWorkflow: (idea, domain, constraints, contextFiles) => {
    const { selectedModel } = get();
    const artifact: PatentArtifact = {
      baseIdea: idea.trim(),
      baseDomain: domain.trim(),
      constraints: constraints?.trim() || undefined,
      contextFiles: contextFiles?.length ? contextFiles : undefined,
      inventors: [],
      figures: [],
      sections: {},
      model: selectedModel,
      startedAt: Date.now(),
    };
    set({
      artifact,
      workflowPhase: 'working',
      currentStepIndex: 0,
      steps: getInitialSteps().map((s, i) => ({
        ...s,
        status: i === 0 ? ('input' as const) : ('pending' as const),
        options: [],
        selectedOption: null,
      })),
      generationStatus: 'idle',
      lastError: null,
    });
    // No auto-generate — user chooses mode in StepInputPanel
  },

  generateStepOptions: async (overridePrompt?: string) => {
    const { steps, currentStepIndex, artifact, selectedModel, appSettings } = get();
    if (!artifact || currentStepIndex < 0 || currentStepIndex >= steps.length) return;

    const step = steps[currentStepIndex];

    // D-4: manual draft present — bypass generation pipeline entirely
    if (step.inputMode === 'manual' && step.manualDraft.trim().length > 0) {
      get().submitManualContent(step.manualDraft);
      return;
    }

    const usedMode = step.inputMode === 'guided' ? 'guided' : 'auto';
    const module = WORKFLOW_MODULES[step.moduleId];

    // Create a fresh abort controller for this generation
    _abortController = new AbortController();

    set({ generationStatus: 'loading', lastError: null, streamingOptions: [] });
    set((state) => ({
      steps: state.steps.map((s, i) =>
        i === currentStepIndex ? { ...s, status: 'generating' } : s
      ),
    }));

    const prompt =
      overridePrompt ??
      `${module.systemContext(appSettings.numOptions)}\n\n---\n\n${module.buildPrompt(artifact, appSettings.numOptions)}`;

    let accumulated = '';
    const result = await streamPatentContent(
      { prompt, model: selectedModel },
      (chunk) => {
        accumulated += chunk;
        set({ streamingOptions: parseStreamingOptions(accumulated) });
      },
      _abortController.signal,
      appSettings.llmTimeoutMs
    );

    set({ streamingOptions: [] });

    // If cancelled, error message will be 'Generation cancelled.'
    if (isApiError(result)) {
      const cancelled = result.error === 'Generation cancelled.';
      set({
        generationStatus: cancelled ? 'idle' : 'error',
        lastError: cancelled ? null : result.error,
      });
      set((state) => ({
        steps: state.steps.map((s, i) =>
          i === currentStepIndex ? { ...s, status: 'input' } : s
        ),
      }));
      return;
    }

    const rawResponse = accumulated;
    const parsed = parseOptions(sanitizeOutput(rawResponse));
    const options: GeneratedOption[] = parsed.map((content, i) => ({
      id: generateId(),
      index: i,
      content,
    }));

    set((state) => ({
      generationStatus: 'success',
      steps: state.steps.map((s, i) =>
        i === currentStepIndex
          ? {
              ...s,
              status: 'selecting',
              inputMode: usedMode,
              optionsByMode: { ...s.optionsByMode, [usedMode]: options },
              promptTokens: result.promptTokens,
              completionTokens: result.completionTokens,
            }
          : s
      ),
    }));
  },

  cancelGeneration: () => {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    const { currentStepIndex } = get();
    set({ generationStatus: 'idle', lastError: null, streamingOptions: [] });
    if (currentStepIndex >= 0) {
      set((state) => ({
        steps: state.steps.map((s, i) =>
          i === currentStepIndex ? { ...s, status: 'input' } : s
        ),
      }));
    }
  },

  submitManualContent: (content: string) => {
    const option: GeneratedOption = {
      id: generateId(),
      index: 0,
      content: content.trim(),
    };
    get().selectOption(option);
  },

  selectOption: (option: GeneratedOption) => {
    const { currentStepIndex, steps, artifact } = get();
    if (!artifact || currentStepIndex < 0) return;

    const step = steps[currentStepIndex];
    const newArtifact: PatentArtifact = {
      ...artifact,
      sections: {
        ...artifact.sections,
        [step.moduleId]: {
          moduleId: step.moduleId,
          content: option.content,
          selectedAt: Date.now(),
          optionIndex: option.index,
        },
      },
    };

    const nextIndex = currentStepIndex + 1;
    const isComplete = nextIndex >= steps.length;

    // Cascade: if changing a prior step that already had a selection and downstream steps are done
    const wasAlreadySelected = step.selectedOption !== null;
    const hasDownstreamDone = steps.slice(currentStepIndex + 1).some((s) => s.selectedOption !== null);
    const triggerCascade = wasAlreadySelected && hasDownstreamDone;

    set((state) => ({
      artifact: newArtifact,
      steps: state.steps.map((s, i) => {
        if (i === currentStepIndex) return { ...s, status: 'done', selectedOption: option };
        if (i === nextIndex && !isComplete) return { ...s, status: 'input' };
        return s;
      }),
      currentStepIndex: isComplete ? currentStepIndex : nextIndex,
      workflowPhase: 'working',
      generationStatus: 'idle',
      pendingCascadeFromStep: triggerCascade ? currentStepIndex : null,
    }));

    if (isComplete) {
      set({ workflowPhase: 'figures' });
    }
  },

  initSessions: async () => {
    const remote = await fetchSessions();
    if (remote.length > 0) set({ sessions: remote.map((s) => ({ ...s, persisted: true })) });
  },

  saveCurrentSession: () => {
    const { steps, artifact, selectedModel, figuresDraft, workflowPhase, currentStepIndex, reviewResult } = get();
    if (!artifact || Object.keys(artifact.sections).length === 0) return;
    const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);
    const stepInputStates = steps.map((s) => ({
      moduleId: s.moduleId,
      inputMode: s.inputMode,
      guidedFields: s.guidedFields,
      manualDraft: s.manualDraft,
      optionsByMode: s.optionsByMode,
      status: s.status,
    }));
    set((state) => {
      const existingIndex = state.sessions.findIndex((s) => s.startedAt === artifact.startedAt);
      // Preserve persisted flag if session already exists
      const existingPersisted = existingIndex >= 0 ? state.sessions[existingIndex].persisted : false;
      const session: WorkflowSession = {
        id: existingIndex >= 0 ? state.sessions[existingIndex].id : generateId(),
        startedAt: artifact.startedAt,
        completedAt: Date.now(),
        baseIdea: artifact.baseIdea,
        artifact,
        model: selectedModel,
        totalTokens,
        persisted: existingPersisted,
        stepInputStates,
        figuresDraft,
        lastPhase: workflowPhase,
        lastStepIndex: currentStepIndex,
        reviewResult
      };
      if (existingIndex >= 0) {
        const updated = [...state.sessions];
        updated[existingIndex] = session;
        return { sessions: updated };
      }
      return { sessions: [session, ...state.sessions].slice(0, 20) };
    });
  },

  persistDraft: async () => {
    const { steps, artifact, selectedModel, sessions, figuresDraft, workflowPhase, currentStepIndex, reviewResult } = get();
    if (!artifact || Object.keys(artifact.sections).length === 0) return;
    const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);
    const stepInputStates = steps.map((s) => ({
      moduleId: s.moduleId,
      inputMode: s.inputMode,
      guidedFields: s.guidedFields,
      manualDraft: s.manualDraft,
      optionsByMode: s.optionsByMode,
      status: s.status,
    }));
    const existingIndex = sessions.findIndex((s) => s.startedAt === artifact.startedAt);
    const session: WorkflowSession = {
      id: existingIndex >= 0 ? sessions[existingIndex].id : generateId(),
      startedAt: artifact.startedAt,
      completedAt: Date.now(),
      baseIdea: artifact.baseIdea,
      artifact,
      model: selectedModel,
      totalTokens,
      persisted: true,
      stepInputStates,
      figuresDraft,
      lastPhase: workflowPhase,
      lastStepIndex: currentStepIndex,
      reviewResult
    };
    await saveSession(session);
    set((state) => {
      const idx = state.sessions.findIndex((s) => s.startedAt === artifact.startedAt);
      if (idx >= 0) {
        const updated = [...state.sessions];
        updated[idx] = session;
        return { sessions: updated };
      }
      return { sessions: [session, ...state.sessions].slice(0, 20) };
    });
  },

  regenerateOptions: () => {
    const { currentStepIndex, steps } = get();
    const mode = steps[currentStepIndex]?.inputMode === 'guided' ? 'guided' : 'auto';
    set((state) => ({
      steps: state.steps.map((s, i) =>
        i === currentStepIndex
          ? { ...s, status: 'input', optionsByMode: { ...s.optionsByMode, [mode]: [] } }
          : s
      ),
      generationStatus: 'idle',
      lastError: null,
    }));
  },

  goToStep: (index: number) => {
    const { steps, diagramGenerating } = get();
    if (diagramGenerating) return;
    if (index < 0 || index >= steps.length) return;

    const step = steps[index];
    set({
      currentStepIndex: index,
      workflowPhase: 'working',
      generationStatus: 'idle',
      lastError: null,
    });

    // Restore an actionable status so the panel always has something to show.
    const anyOptions = step.optionsByMode.auto.length > 0 || step.optionsByMode.guided.length > 0;
    const needsRestore = step.status === 'done' || step.status === 'pending' || !anyOptions;
    let restoredStatus = step.status;
    if (needsRestore) {
      restoredStatus = anyOptions ? 'selecting' : 'input';
    }

    if (restoredStatus !== step.status) {
      set((state) => ({
        steps: state.steps.map((s, i) =>
          i === index ? { ...s, status: restoredStatus } : s
        ),
      }));
    }
  },

  goToFigures: () => set({ workflowPhase: 'figures' }),

  goToInventors: () => {
    if (get().diagramGenerating) return;
    set({ workflowPhase: 'inventors' });
  },

  updateInventors: (inventors) => {
    set((state) => {
      if (!state.artifact) return {};
      return { artifact: { ...state.artifact, inventors } };
    });
  },

  updatePatentMeta: (idfNumber, businessGroup) => {
    set((state) => {
      if (!state.artifact) return {};
      return {
        artifact: {
          ...state.artifact,
          idfNumber: idfNumber || undefined,
          businessGroup: businessGroup || undefined,
        },
      };
    });
  },

  updateFigures: (figures) => {
    set((state) => {
      if (!state.artifact) return {};
      return { artifact: { ...state.artifact, figures } };
    });
  },

  updateInventionTitle: (inventionTitle) => {
    set((state) => {
      if (!state.artifact) return {};
      return { artifact: { ...state.artifact, inventionTitle } };
    });
  },

  goToPreview: () => {
    if (get().diagramGenerating) return;
    set({ workflowPhase: 'preview' });
  },

  goToReview: () => {
    if (get().diagramGenerating) return;
    set({ workflowPhase: 'review' });
  },

  clearReview: () => set({ reviewResult: null, reviewStatus: 'idle', reviewPass: null }),

  cancelReview: () => {
    _reviewAbortController?.abort();
    _reviewAbortController = null;
    set({ reviewStatus: 'idle', reviewPass: null });
  },

  startReview: async () => {
    const { artifact, selectedModel, appSettings, template, reviewResult: previousResult } = get();
    if (!artifact) return;

    _reviewAbortController?.abort();
    _reviewAbortController = new AbortController();
    set({ reviewStatus: 'loading', reviewResult: null, reviewPass: null });

    const reviewCfg = template.review ?? (bundledTemplates as unknown as RegTemplate).review;
    const maxChars = reviewCfg?.maxDocumentChars ?? 12_000;
    const passes = reviewCfg?.passes;
    const presentSections = WORKFLOW_ORDER.filter((id) => artifact.sections[id]);
    const documentSnapshot = buildDocSnapshot(artifact);

    const deterministicFindings = runDeterministicChecks(artifact, presentSections);
    const [changedSections, reusedFindings] = computeIncrementalState(artifact, presentSections, previousResult);
    const ctx: ReviewCtx = {
      selectedModel,
      signal: _reviewAbortController.signal,
      timeoutMs: appSettings.llmTimeoutMs,
      sectionListHint: buildSectionHint(presentSections),
      priorContext: buildPriorContext(artifact, previousResult),
      docText: buildDocText(artifact, presentSections, maxChars),
      fullDocText: presentSections.map((id) => artifact.sections[id]!.content).join('\n\n'),
      documentSnapshot,
      changedSections,
      reusedFindings,
    };

    const outcome = passes && passes.length >= 2
      ? await runMultiPass(passes, deterministicFindings, ctx, (lbl) => set({ reviewPass: lbl }))
      : await runSinglePass(reviewCfg?.systemContext ?? '', deterministicFindings, ctx);

    _reviewAbortController = null;

    if (outcome.type === 'success') {
      set({ reviewStatus: 'success', reviewResult: outcome.result, reviewPass: null });
    } else if (outcome.type === 'cancelled') {
      set({ reviewStatus: 'idle', reviewPass: null });
    } else {
      set({ reviewStatus: 'error', lastError: outcome.message, reviewPass: null });
    }
  },

  resetWorkflow: () => {
    // Save session before clearing if there's content worth keeping
    get().saveCurrentSession();

    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    set({
      workflowPhase: 'input',
      steps: getInitialSteps(),
      currentStepIndex: -1,
      artifact: null,
      generationStatus: 'idle',
      lastError: null,
      streamingOptions: [],
      figuresDraft: { diagramNodes: [], diagramEdges: [], jsonText: '' },
      diagramGenerating: false,
      reviewResult: null,
      reviewStatus: 'idle',
    });
  },

  updateSectionContent: (moduleId, content) => {
    set((state) => {
      if (!state.artifact) return {};
      return {
        artifact: {
          ...state.artifact,
          sections: {
            ...state.artifact.sections,
            [moduleId]: {
              ...state.artifact.sections[moduleId]!,
              content,
            },
          },
        },
      };
    });
  },

  updateArtifactBase: (idea, domain, constraints) => {
    set((state) => {
      if (!state.artifact) return {};
      return {
        artifact: {
          ...state.artifact,
          baseIdea: idea,
          baseDomain: domain,
          constraints: constraints || undefined,
        },
      };
    });
  },

  updateContextFiles: (files) => {
    set((state) => {
      if (!state.artifact) return {};
      return {
        artifact: {
          ...state.artifact,
          contextFiles: files.length ? files : undefined,
        },
      };
    });
  },

  setDiagramDraft: (nodes, edges) => {
    set((state) => ({ figuresDraft: { ...state.figuresDraft, diagramNodes: nodes, diagramEdges: edges } }));
  },

  setJsonDraftText: (text) => {
    set((state) => ({ figuresDraft: { ...state.figuresDraft, jsonText: text } }));
  },

  setStepInputState: (index, patch) => {
    set((state) => ({
      steps: state.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  },

  loadSession: async (session: WorkflowSession) => {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    // For persisted sessions, fetch full data to get figure dataUrls
    // (the list endpoint strips them for performance)
    let s = session;
    if (session.persisted) {
      const full = await getSession(session.id);
      if (full) s = { ...full, persisted: true };
    }
    // Warn about sections saved under IDs that no longer exist in the current template.
    const orphaned = Object.keys(s.artifact.sections).filter((id) => !WORKFLOW_MODULES[id]);
    if (orphaned.length > 0) {
      console.warn('[loadSession] Session contains sections not in current workflow:', orphaned);
    }

    const steps = WORKFLOW_ORDER.map((moduleId) => {
      const section = s.artifact.sections[moduleId];
      const mod = WORKFLOW_MODULES[moduleId];
      if (!mod) {
        // Should never happen (WORKFLOW_ORDER and WORKFLOW_MODULES share the same source),
        // but guard defensively to avoid a crash on template mismatch.
        console.error('[loadSession] moduleId in WORKFLOW_ORDER has no matching module:', moduleId);
        return null;
      }
      const selectedOption = section
        ? { id: generateId(), index: section.optionIndex, content: section.content }
        : null;
      const saved = s.stepInputStates?.find((si) => si.moduleId === moduleId);
      const savedMode = saved?.inputMode ?? 'auto';
      const optionMode = savedMode === 'guided' ? 'guided' : 'auto';

      // Restore status: 'done' is authoritative from artifact.sections;
      // 'selecting' and 'input' are restored from saved state; everything else → 'pending'
      let resolvedStatus: StepStatus = 'pending';
      if (section) {
        resolvedStatus = 'done';
      } else if (saved?.status === 'selecting' || saved?.status === 'input') {
        resolvedStatus = saved.status;
      }

      // Restore full options list when available; fall back to single selected option for
      // sessions saved before this field was added, or for manual steps where optionsByMode
      // is always empty (manual content is stored in selectedOption/section instead)
      const storedOptions = saved?.optionsByMode;
      const hasStoredOptions =
        storedOptions && (storedOptions.auto.length > 0 || storedOptions.guided.length > 0);
      const resolvedOptions: { auto: GeneratedOption[]; guided: GeneratedOption[] } =
        hasStoredOptions
          ? storedOptions
          : {
              auto: optionMode === 'auto' && selectedOption ? [selectedOption] : [],
              guided: optionMode === 'guided' && selectedOption ? [selectedOption] : [],
            };

      return {
        moduleId,
        label: mod.label,
        description: mod.description,
        status: resolvedStatus,
        optionsByMode: resolvedOptions,
        selectedOption,
        promptTokens: 0,
        completionTokens: 0,
        inputMode: savedMode,
        guidedFields: saved?.guidedFields ?? ({} as Record<string, string>),
        manualDraft: saved?.manualDraft ?? '',
      };
    }).filter((step) => step !== null);
    set({
      artifact: {
        ...s.artifact,
        figures: s.artifact.figures ?? [],
      },
      steps,
      currentStepIndex: s.lastStepIndex ?? steps.length - 1,
      workflowPhase: s.lastPhase ?? 'preview',
      generationStatus: 'idle',
      lastError: null,
      selectedModel: s.model,
      figuresDraft: s.figuresDraft ?? { diagramNodes: [], diagramEdges: [], jsonText: '' },
      reviewResult: s.reviewResult ?? null,
      reviewStatus: s.reviewResult ? 'success' as const : 'idle' as const
    });
  },

  clearSessions: () => {
    // Only delete persisted ones from the server; cached ones just disappear from memory
    const { sessions } = get();
    if (sessions.some((s) => s.persisted)) clearAllSessions();
    set({ sessions: [] });
  },

  deleteSession: (id: string) => {
    const { sessions } = get();
    const target = sessions.find((s) => s.id === id);
    if (target?.persisted) apiDeleteSession(id);
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
  },

  loadSettings: async () => {
    const data = await getSettings();
    if (!data) return;
    setApiKey(data.apiKey);
    set({ appSettings: data });
    set((state) => {
      if (state.availableModels.length === 0) return { selectedModel: data.defaultModel };
      return {};
    });
  },

  saveSettings: async (patch) => {
    const current = get().appSettings;
    const next = { ...current, ...patch };
    const confirmed = await apiUpdateSettings(next);
    if (confirmed) { set({ appSettings: confirmed }); return true; }
    return false;
  },

  resetSettings: async () => {
    const confirmed = await apiResetSettings();
    if (!confirmed) return;
    setApiKey(confirmed.apiKey);
    set({ appSettings: confirmed });
  },

  loadTemplate: async () => {
    const data = await getTemplate();
    if (!data) return;
    reinitFromTemplate(data);
    set({ template: data });
  },

  saveTemplate: async (t: RegTemplate) => {
    const confirmed = await apiUpdateTemplate(t);
    if (!confirmed) return;
    reinitFromTemplate(confirmed);
    set({ template: confirmed });
  },

  resetTemplate: async () => {
    const confirmed = await apiResetTemplate();
    if (!confirmed) return;
    reinitFromTemplate(confirmed);
    set({ template: confirmed });
  },
}));
