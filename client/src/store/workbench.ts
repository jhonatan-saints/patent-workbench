import { create } from 'zustand';
import type { WorkbenchState, PatentSection, GenerationRecord } from '../types';
import { generatePatentContent, getModels, getStatus, isApiError } from '../api/client';
import { sanitizePrompt, sanitizeOutput, generateId } from '../utils/sanitize';

const DEFAULT_MODEL = 'mistral';

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  // LLM
  selectedModel: DEFAULT_MODEL,
  availableModels: [],
  llmStatus: 'checking',
  llmLatency: null,

  // Generation
  currentPrompt: '',
  currentSection: 'custom',
  generationStatus: 'idle',
  lastResponse: null,
  lastError: null,

  // History
  history: [],

  // Actions

  setModel: (model) => set({ selectedModel: model }),
  setPrompt: (prompt) => set({ currentPrompt: prompt }),
  setSection: (section: PatentSection | 'custom') => set({ currentSection: section }),

  generate: async () => {
    const { currentPrompt, selectedModel, currentSection } = get();

    const cleanPrompt = sanitizePrompt(currentPrompt);
    if (!cleanPrompt) return;

    set({ generationStatus: 'loading', lastError: null, lastResponse: null });

    const result = await generatePatentContent({
      prompt: cleanPrompt,
      model: selectedModel,
    });

    if (isApiError(result)) {
      set({ generationStatus: 'error', lastError: result.error });
      return;
    }

    const rawResponse = result.data.response;
    const safeResponse = sanitizeOutput(rawResponse);

    const record: GenerationRecord = {
      id: generateId(),
      timestamp: Date.now(),
      section: currentSection,
      prompt: cleanPrompt,
      response: safeResponse,
      model: selectedModel,
      promptTokens: result.data.promptTokens,
      completionTokens: result.data.completionTokens,
    };

    set((state) => ({
      generationStatus: 'success',
      lastResponse: safeResponse,
      history: [record, ...state.history].slice(0, 50), // cap at 50 records in-memory
    }));
  },

  checkStatus: async () => {
    set({ llmStatus: 'checking' });
    const [status, models] = await Promise.all([getStatus(), getModels()]);
    set((state) => ({
      llmStatus: status.llm,
      llmLatency: status.latency,
      ...(models.length > 0 && {
        availableModels: models,
        selectedModel: models.includes(state.selectedModel) ? state.selectedModel : models[0],
      }),
    }));
  },

  clearHistory: () => set({ history: [] }),

  deleteRecord: (id) =>
    set((state) => ({
      history: state.history.filter((r) => r.id !== id),
    })),
}));
