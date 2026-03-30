import { create } from 'zustand';
import type {
  WorkbenchState,
  PatentArtifact,
  WorkflowSession,
  GeneratedOption,
} from '@/types';
import { generatePatentContent, getModels, getStatus, isApiError } from '@/api/client';
import { sanitizeOutput, generateId } from '@/utils/sanitize';
import { WORKFLOW_MODULES, WORKFLOW_ORDER } from '@/utils/workflowTemplates';
import { parseOptions } from '@/utils/optionParser';

const DEFAULT_MODEL = 'mistral';

const INITIAL_STEPS = WORKFLOW_ORDER.map((moduleId) => ({
  moduleId,
  label: WORKFLOW_MODULES[moduleId].label,
  description: WORKFLOW_MODULES[moduleId].description,
  status: 'pending' as const,
  options: [],
  selectedOption: null,
  promptTokens: 0,
  completionTokens: 0,
}));

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  // ─── LLM ────────────────────────────────────────────────────────────────────
  selectedModel: DEFAULT_MODEL,
  availableModels: [],
  llmStatus: 'checking',
  llmLatency: null,

  // ─── Workflow ────────────────────────────────────────────────────────────────
  workflowPhase: 'input',
  steps: INITIAL_STEPS,
  currentStepIndex: -1,
  artifact: null,
  generationStatus: 'idle',
  lastError: null,

  // ─── Sessions ────────────────────────────────────────────────────────────────
  sessions: [],

  // ─── Actions ─────────────────────────────────────────────────────────────────

  setModel: (model) => set({ selectedModel: model }),

  checkStatus: async () => {
    set({ llmStatus: 'checking' });
    const [status, models] = await Promise.all([getStatus(), getModels()]);
    set((state) => ({
      llmStatus: status.llm,
      llmLatency: status.latency,
      ...(models.length > 0 && {
        availableModels: models,
        selectedModel:
          models.find((m) => m.split(':')[0] === state.selectedModel.split(':')[0]) ??
          models[0],
      }),
    }));
  },

  startWorkflow: (idea, domain, constraints) => {
    const { selectedModel } = get();
    const artifact: PatentArtifact = {
      baseIdea: idea.trim(),
      baseDomain: domain.trim(),
      constraints: constraints?.trim() || undefined,
      sections: {},
      model: selectedModel,
      startedAt: Date.now(),
    };
    set({
      artifact,
      workflowPhase: 'working',
      currentStepIndex: 0,
      steps: INITIAL_STEPS.map((s) => ({
        ...s,
        status: 'pending',
        options: [],
        selectedOption: null,
      })),
      generationStatus: 'idle',
      lastError: null,
    });
    get().generateStepOptions();
  },

  generateStepOptions: async () => {
    const { steps, currentStepIndex, artifact, selectedModel } = get();
    if (!artifact || currentStepIndex < 0 || currentStepIndex >= steps.length) return;

    const step = steps[currentStepIndex];
    const module = WORKFLOW_MODULES[step.moduleId];

    set({ generationStatus: 'loading', lastError: null });
    set((state) => ({
      steps: state.steps.map((s, i) =>
        i === currentStepIndex ? { ...s, status: 'generating', options: [] } : s
      ),
    }));

    const prompt = `${module.systemContext}\n\n---\n\n${module.buildPrompt(artifact)}`;
    const result = await generatePatentContent({ prompt, model: selectedModel });

    if (isApiError(result)) {
      set({ generationStatus: 'error', lastError: result.error });
      set((state) => ({
        steps: state.steps.map((s, i) =>
          i === currentStepIndex ? { ...s, status: 'pending' } : s
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
      steps: state.steps.map((s, i) =>
        i === currentStepIndex ? { ...s, status: 'done', selectedOption: option } : s
      ),
      currentStepIndex: isComplete ? currentStepIndex : nextIndex,
      workflowPhase: isComplete ? 'preview' : 'working',
      generationStatus: 'idle',
    }));

    if (isComplete) {
      const { steps: finalSteps } = get();
      const totalTokens = finalSteps.reduce(
        (acc, s) => acc + s.promptTokens + s.completionTokens,
        0
      );
      const session: WorkflowSession = {
        id: generateId(),
        startedAt: newArtifact.startedAt,
        completedAt: Date.now(),
        baseIdea: newArtifact.baseIdea,
        artifact: newArtifact,
        model: newArtifact.model,
        totalTokens,
      };
      set((state) => ({
        sessions: [session, ...state.sessions].slice(0, 20),
      }));
    } else {
      get().generateStepOptions();
    }
  },

  regenerateOptions: () => get().generateStepOptions(),

  goToStep: (index: number) => {
    const { steps } = get();
    if (index < 0 || index >= steps.length) return;

    set({
      currentStepIndex: index,
      workflowPhase: 'working',
      generationStatus: 'idle',
    });

    const step = steps[index];
    // Re-generate only if step has no cached options
    if (step.options.length === 0) {
      get().generateStepOptions();
    }
  },

  resetWorkflow: () => {
    set({
      workflowPhase: 'input',
      steps: INITIAL_STEPS,
      currentStepIndex: -1,
      artifact: null,
      generationStatus: 'idle',
      lastError: null,
    });
  },

  clearSessions: () => set({ sessions: [] }),

  deleteSession: (id: string) =>
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) })),
}));
