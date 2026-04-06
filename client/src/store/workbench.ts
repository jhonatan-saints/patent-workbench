import { create } from 'zustand';
import type {
  WorkbenchState,
  PatentArtifact,
  WorkflowSession,
  GeneratedOption,
  AppSettings,
} from '@/types';
import {
  generatePatentContent,
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
} from '@/api/client';
import { sanitizeOutput, generateId } from '@/utils/sanitize';
import { WORKFLOW_MODULES, WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import { parseOptions } from '@/utils/optionParser';

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

// Module-level abort controller — not in Zustand state to avoid re-renders
let _abortController: AbortController | null = null;

const INITIAL_STEPS = WORKFLOW_ORDER.map((moduleId) => ({
  moduleId,
  label: WORKFLOW_MODULES[moduleId].label,
  description: WORKFLOW_MODULES[moduleId].description,
  status: 'pending' as const,
  options: [],
  selectedOption: null,
  promptTokens: 0,
  completionTokens: 0,
  inputMode: 'auto' as const,
  guidedFields: {} as Record<string, string>,
  manualDraft: '',
}));

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  // LLM — selectedModel bootstrapped from VITE_DEFAULT_MODEL until loadSettings() resolves
  selectedModel: DEFAULT_MODEL,
  availableModels: [],
  modelContextLength: null,
  llmStatus: 'checking',
  llmLatency: null,

  // Workflow
  workflowPhase: 'input',
  steps: INITIAL_STEPS,
  currentStepIndex: -1,
  artifact: null,
  generationStatus: 'idle',
  lastError: null,

  // Sessions
  sessions: [],

  // Figures workspace drafts
  figuresDraft: { diagramNodes: [], diagramEdges: [], jsonText: '' },

  // App settings
  appSettings: DEFAULT_SETTINGS,

  // Actions

  setModel: (model) => {
    set({ selectedModel: model });
    void get().fetchModelContextLength(model);
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

      if (next.selectedModel) void get().fetchModelContextLength(next.selectedModel);
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
      steps: INITIAL_STEPS.map((s, i) => ({
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
    const module = WORKFLOW_MODULES[step.moduleId];

    // Create a fresh abort controller for this generation
    _abortController = new AbortController();

    set({ generationStatus: 'loading', lastError: null });
    set((state) => ({
      steps: state.steps.map((s, i) =>
        i === currentStepIndex ? { ...s, status: 'generating', options: [] } : s
      ),
    }));

    const prompt =
      overridePrompt ??
      `${module.systemContext(appSettings.numOptions)}\n\n---\n\n${module.buildPrompt(artifact, appSettings.numOptions)}`;

    const result = await generatePatentContent(
      { prompt, model: selectedModel },
      _abortController.signal,
      appSettings.llmTimeoutMs
    );

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

    const rawResponse = result.data.response;
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
              options,
              promptTokens: result.data.promptTokens,
              completionTokens: result.data.completionTokens,
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
    // Step status reset is handled in generateStepOptions error path
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

    set((state) => ({
      artifact: newArtifact,
      steps: state.steps.map((s, i) => {
        if (i === currentStepIndex) return { ...s, status: 'done', selectedOption: option };
        // Mark next step as 'input' so it shows the input panel
        if (i === nextIndex && !isComplete) return { ...s, status: 'input' };
        return s;
      }),
      currentStepIndex: isComplete ? currentStepIndex : nextIndex,
      // Stay in working phase; user navigates to figures/preview via sidebar
      workflowPhase: 'working',
      generationStatus: 'idle',
    }));

    if (isComplete) {
      // Auto-navigate to figures step when all 7 content steps are done
      set({ workflowPhase: 'figures' });
    }
  },

  initSessions: async () => {
    const remote = await fetchSessions();
    if (remote.length > 0) set({ sessions: remote.map((s) => ({ ...s, persisted: true })) });
  },

  saveCurrentSession: () => {
    const { steps, artifact, selectedModel, figuresDraft, workflowPhase, currentStepIndex } = get();
    if (!artifact || Object.keys(artifact.sections).length === 0) return;
    const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);
    const stepInputStates = steps.map((s) => ({
      moduleId: s.moduleId,
      inputMode: s.inputMode,
      guidedFields: s.guidedFields,
      manualDraft: s.manualDraft,
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
    const { steps, artifact, selectedModel, sessions, figuresDraft, workflowPhase, currentStepIndex } = get();
    if (!artifact || Object.keys(artifact.sections).length === 0) return;
    const totalTokens = steps.reduce((acc, s) => acc + s.promptTokens + s.completionTokens, 0);
    const stepInputStates = steps.map((s) => ({
      moduleId: s.moduleId,
      inputMode: s.inputMode,
      guidedFields: s.guidedFields,
      manualDraft: s.manualDraft,
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
    const { currentStepIndex } = get();
    // Reset to input so user can choose mode again
    set((state) => ({
      steps: state.steps.map((s, i) =>
        i === currentStepIndex ? { ...s, status: 'input', options: [] } : s
      ),
      generationStatus: 'idle',
      lastError: null,
    }));
  },

  goToStep: (index: number) => {
    const { steps } = get();
    if (index < 0 || index >= steps.length) return;

    const step = steps[index];
    set({
      currentStepIndex: index,
      workflowPhase: 'working',
      generationStatus: 'idle',
      lastError: null,
    });

    // Restore an actionable status so the panel always has something to show.
    // Manual/guided steps always go back to 'input' so the form is shown.
    const needsRestore = step.status === 'done' || step.status === 'pending' || step.options.length === 0;
    let restoredStatus = step.status;
    if (needsRestore) {
      const showOptions = step.options.length > 0 && step.inputMode !== 'manual' && step.inputMode !== 'guided';
      restoredStatus = showOptions ? 'selecting' : 'input';
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

  goToInventors: () => set({ workflowPhase: 'inventors' }),

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
    set({ workflowPhase: 'preview' });
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
      steps: INITIAL_STEPS,
      currentStepIndex: -1,
      artifact: null,
      generationStatus: 'idle',
      lastError: null,
      figuresDraft: { diagramNodes: [], diagramEdges: [], jsonText: '' },
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
    const steps = WORKFLOW_ORDER.map((moduleId) => {
      const section = s.artifact.sections[moduleId];
      const mod = WORKFLOW_MODULES[moduleId];
      const selectedOption = section
        ? { id: generateId(), index: section.optionIndex, content: section.content }
        : null;
      const saved = s.stepInputStates?.find((si) => si.moduleId === moduleId);
      return {
        moduleId,
        label: mod.label,
        description: mod.description,
        status: section ? ('done' as const) : ('pending' as const),
        options: selectedOption ? [selectedOption] : [],
        selectedOption,
        promptTokens: 0,
        completionTokens: 0,
        inputMode: saved?.inputMode ?? ('auto' as const),
        guidedFields: saved?.guidedFields ?? ({} as Record<string, string>),
        manualDraft: saved?.manualDraft ?? '',
      };
    });
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
    });
  },

  clearSessions: () => {
    // Only delete persisted ones from the server; cached ones just disappear from memory
    const { sessions } = get();
    if (sessions.some((s) => s.persisted)) void clearAllSessions();
    set({ sessions: [] });
  },

  deleteSession: (id: string) => {
    const { sessions } = get();
    const target = sessions.find((s) => s.id === id);
    if (target?.persisted) void apiDeleteSession(id);
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
  },

  loadSettings: async () => {
    const data = await getSettings();
    if (!data) return;
    set({ appSettings: data });
    // Sync selectedModel with persisted default if no models have been loaded yet
    set((state) => {
      if (state.availableModels.length === 0) return { selectedModel: data.defaultModel };
      return {};
    });
  },

  saveSettings: async (patch) => {
    const current = get().appSettings;
    const next = { ...current, ...patch };
    const confirmed = await apiUpdateSettings(next);
    if (confirmed) set({ appSettings: confirmed });
  },
}));
