// API

export interface GenerateRequest {
  prompt: string;
  model?: string;
}

export interface GenerateResponse {
  success: true;
  data: {
    response: string;
    promptTokens: number;
    completionTokens: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResult<T> = T | ApiError;

export interface StatusResponse {
  server: 'ok' | 'error';
  llm: 'ok' | 'unavailable';
  latency: number;
}

export interface ModelsResponse {
  success: true;
  data: { models: string[] };
}

// Domain

export type PatentSection =
  | 'title'
  | 'field'
  | 'background'
  | 'summary'
  | 'claims'
  | 'description'
  | 'abstract';

export interface PatentPromptTemplate {
  id: PatentSection;
  label: string;
  description: string;
  systemContext: string;
  userTemplate: string;
  tokenEstimate: number;
}

export interface GenerationRecord {
  id: string;
  timestamp: number;
  section: PatentSection | 'custom';
  prompt: string;
  response: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

// UI State

export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface WorkbenchState {
  // LLM
  selectedModel: string;
  availableModels: string[];
  llmStatus: 'ok' | 'unavailable' | 'checking';
  llmLatency: number | null;

  // Generation
  currentPrompt: string;
  currentSection: PatentSection | 'custom';
  generationStatus: GenerationStatus;
  lastResponse: string | null;
  lastError: string | null;

  // History (in-memory only)
  history: GenerationRecord[];

  // Actions
  setModel: (model: string) => void;
  setPrompt: (prompt: string) => void;
  setSection: (section: PatentSection | 'custom') => void;
  generate: () => Promise<void>;
  checkStatus: () => Promise<void>;
  clearHistory: () => void;
  deleteRecord: (id: string) => void;
}
