// API types
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
export type WorkflowPhase = 'input' | 'working' | 'figures' | 'inventors' | 'preview';
export type InputMode = 'auto' | 'guided' | 'manual';

// 'input' = showing the 3-mode input panel (auto/guided/manual)
export type StepStatus = 'pending' | 'input' | 'generating' | 'selecting' | 'done';

export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface GeneratedOption {
  id: string;
  index: number;
  content: string;
}

export interface WorkflowStep {
  moduleId: string;
  label: string;
  description: string;
  status: StepStatus;
  options: GeneratedOption[];
  selectedOption: GeneratedOption | null;
  promptTokens: number;
  completionTokens: number;
  inputMode: InputMode;
  guidedFields: Record<string, string>;
  manualDraft: string;
}

export interface ArtifactSection {
  moduleId: string;
  content: string;
  selectedAt: number;
  optionIndex: number;
}

export interface InventorInfo {
  id: string;
  name: string;
  address?: string;
  telephone?: string;
  email?: string;
  citizenship?: string;
  employeeId?: string;
}

export interface ContextFile {
  id: string;
  name: string;
  content: string;  // plain text content
  size: number;     // original byte size
}

export interface FigureItem {
  id: string;
  dataUrl: string;   // base64 data URL
  name: string;      // e.g. "Figure 1"
  caption: string;
  width?: number;
  height?: number;
  type?: 'image' | 'diagram' | 'json';
}

export interface PatentArtifact {
  baseIdea: string;
  baseDomain: string;
  constraints?: string;
  contextFiles?: ContextFile[];
  inventionTitle?: string;
  idfNumber?: string;
  businessGroup?: string;
  inventors: InventorInfo[];
  figures: FigureItem[];
  sections: Partial<Record<string, ArtifactSection>>;
  model: string;
  startedAt: number;
}

export interface FiguresDraft {
  diagramNodes: unknown[];
  diagramEdges: unknown[];
  jsonText: string;
}

export interface WorkflowSession {
  id: string;
  startedAt: number;
  completedAt: number;
  baseIdea: string;
  artifact: PatentArtifact;
  model: string;
  totalTokens: number;
  persisted: boolean; // true = saved to SQLite; false = in-memory cache only
  stepInputStates?: Array<{
    moduleId: string;
    inputMode: InputMode;
    guidedFields: Record<string, string>;
    manualDraft: string;
  }>;
  figuresDraft?: FiguresDraft;
  lastPhase?: WorkflowPhase;
  lastStepIndex?: number;
}

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface AppSettings {
  defaultModel: string;
  llmTimeoutMs: number;
  numOptions: number;
  ollamaUrl: string;
  promptMaxLength: number;
  shutdownTimeoutMs: number;
  logLevel: LogLevel;
}

// UI state
export interface WorkbenchState {
  // LLM
  selectedModel: string;
  availableModels: string[];
  modelContextLength: number | null;
  llmStatus: 'ok' | 'unavailable' | 'checking';
  llmLatency: number | null;

  // Workflow
  workflowPhase: WorkflowPhase;
  steps: WorkflowStep[];
  currentStepIndex: number; // -1 = idea input phase
  artifact: PatentArtifact | null;
  generationStatus: GenerationStatus;
  lastError: string | null;

  // Sessions (persisted via server SQLite)
  sessions: WorkflowSession[];

  // Figures workspace drafts (diagram board + JSON editor)
  figuresDraft: FiguresDraft;
  setDiagramDraft: (nodes: unknown[], edges: unknown[]) => void;
  setJsonDraftText: (text: string) => void;

  // Actions
  setModel: (model: string) => void;
  checkStatus: () => Promise<void>;
  startWorkflow: (idea: string, domain: string, constraints: string | undefined, contextFiles?: ContextFile[]) => void;
  fetchModelContextLength: (model: string) => Promise<void>;
  goToFigures: () => void;
  goToInventors: () => void;
  updateInventors: (inventors: InventorInfo[]) => void;
  updatePatentMeta: (idfNumber: string | undefined, businessGroup: string | undefined) => void;
  updateFigures: (figures: FigureItem[]) => void;
  updateInventionTitle: (title: string) => void;
  generateStepOptions: (overridePrompt?: string) => Promise<void>;
  cancelGeneration: () => void;
  submitManualContent: (content: string) => void;
  setStepInputState: (index: number, patch: { inputMode?: InputMode; guidedFields?: Record<string, string>; manualDraft?: string }) => void;
  selectOption: (option: GeneratedOption) => void;
  regenerateOptions: () => void;
  goToStep: (index: number) => void;
  goToPreview: () => void;
  resetWorkflow: () => void;
  updateSectionContent: (moduleId: string, content: string) => void;
  updateArtifactBase: (idea: string, domain: string, constraints: string | undefined) => void;
  updateContextFiles: (files: ContextFile[]) => void;
  initSessions: () => Promise<void>;
  saveCurrentSession: () => void;
  persistDraft: () => Promise<void>;
  loadSession: (session: WorkflowSession) => Promise<void>;
  clearSessions: () => void;
  deleteSession: (id: string) => void;

  // App settings
  appSettings: AppSettings;
  loadSettings: () => Promise<void>;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
}
