//  API client and domain types
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

// Workflow domain types
export type WorkflowModuleId =
  | 'idea_analysis'
  | 'title'
  | 'field'
  | 'background'
  | 'summary'
  | 'claims'
  | 'description'
  | 'abstract';

export type WorkflowPhase = 'input' | 'working' | 'preview';
export type StepStatus = 'pending' | 'generating' | 'selecting' | 'done';
export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface GeneratedOption {
  id: string;
  index: number;
  content: string;
}

export interface WorkflowStep {
  moduleId: WorkflowModuleId;
  label: string;
  description: string;
  status: StepStatus;
  options: GeneratedOption[];
  selectedOption: GeneratedOption | null;
  promptTokens: number;
  completionTokens: number;
}

export interface ArtifactSection {
  moduleId: WorkflowModuleId;
  content: string;
  selectedAt: number;
  optionIndex: number;
}

export interface PatentArtifact {
  baseIdea: string;
  baseDomain: string;
  constraints?: string;
  sections: Partial<Record<WorkflowModuleId, ArtifactSection>>;
  model: string;
  startedAt: number;
}

export interface WorkflowSession {
  id: string;
  startedAt: number;
  completedAt: number;
  baseIdea: string;
  artifact: PatentArtifact;
  model: string;
  totalTokens: number;
}

// UI state
export interface WorkbenchState {
  // LLM
  selectedModel: string;
  availableModels: string[];
  llmStatus: 'ok' | 'unavailable' | 'checking';
  llmLatency: number | null;

  // Workflow
  workflowPhase: WorkflowPhase;
  steps: WorkflowStep[];
  currentStepIndex: number; // -1 = idea input phase
  artifact: PatentArtifact | null;
  generationStatus: GenerationStatus;
  lastError: string | null;

  // Sessions (in-memory only)
  sessions: WorkflowSession[];

  // Actions
  setModel: (model: string) => void;
  checkStatus: () => Promise<void>;
  startWorkflow: (idea: string, domain: string, constraints?: string) => void;
  generateStepOptions: () => Promise<void>;
  selectOption: (option: GeneratedOption) => void;
  regenerateOptions: () => Promise<void>;
  goToStep: (index: number) => void;
  resetWorkflow: () => void;
  clearSessions: () => void;
  deleteSession: (id: string) => void;
}
