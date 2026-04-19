# Client — patent-workbench

React + Vite frontend for Patent Workbench. Provides a structured, five-phase interface for drafting all seven IDF sections using a local LLM, with three generated options to compare and select at each step.

## Stack

| Technology | Version | Role |
| --- | --- | --- |
| React | 18.3.1 | UI framework |
| TypeScript | — | Type safety across all modules |
| Vite | 5.3.4 | Dev server and bundler |
| Tailwind CSS | v4 (via `@tailwindcss/vite`) | Utility-first styling |
| Mantine | v7.11.0 | Component library (forms, modals, layout) |
| Zustand | 4.5.4 | Lightweight global state management |
| Tabler Icons | 3.11.0 | Icon set |
| `@xyflow/react` | 12.10.2 | In-app flowchart / diagram editor |
| `docx` | 9.6.1 | Word document export |
| `html-to-image` | 1.11.13 | PNG export from diagram editor |

---

## Source structure

```
src/
├── api/
│   └── client.ts              # Typed API client — all server calls go through here
├── components/
│   └── workflow/              # Per-phase and per-step workflow components
├── services/
│   └── llm.service.ts         # LLM client service wrapper
├── store/
│   └── workbench.ts           # Zustand store (entire app state machine)
├── theme/
│   └── preset.ts              # Mantine theme customisation
├── types/
│   └── index.ts               # Shared TypeScript type definitions
├── config/
│   └── reg-templates.json     # Editable REG system contexts — customise without touching app code
├── utils/
│   ├── workflowTemplates.ts   # REG module definitions (defaults mirror reg-templates.json) + RAG context builder
│   ├── optionParser.ts        # Parse OPTION 1/2/3 from LLM response
│   └── sanitize.ts            # Output XSS prevention + ID generation
├── assets/                    # Fonts and icons
├── App.tsx                    # Root layout (AppShell + resizable split view)
└── main.tsx                   # React entry point (MantineProvider)
```

---

## Components

### Workflow components (`components/workflow/`)

| Component | Phase | Description |
| --- | --- | --- |
| `IdeaInputStep` | input | Collects invention idea, domain, constraints, and optional context files; launches the workflow |
| `StepProgress` | working | Left sidebar listing all 7 steps with status badges; click any step to navigate back to it |
| `StepInputPanel` | working | Per-step panel with Auto / Guided / Manual mode tabs; triggers generation |
| `OptionsPanel` | working | Grid of the three generated options for the current step |
| `OptionCard` | working | Individual option card with select and copy actions |
| `ArtifactPreview` | working | Live right-panel preview of all sections selected so far |
| `FiguresStep` | figures | Manage figures: upload images, create diagrams, render JSON; local state is synced to `artifact.figures` on every change so Save Draft and sidebar navigation always see the latest figures |
| `DiagramEditor` | figures | In-app flowchart editor (`@xyflow/react`); exports board as PNG; board state is auto-saved to `figuresDraft.diagramNodes/diagramEdges` |
| `JsonViewer` | figures | JSON editor with syntax-highlighted preview; exports rendered view as PNG; draft text is auto-saved to `figuresDraft.jsonText` |
| `InventorsStep` | inventors | Form to add/remove inventors and optional patent metadata (IDF number, business group) |
| `PreviewPhase` | preview | Full artifact review with inline section editing and export |
| `DraftsPanel` | all | Persistent session history sidebar (restore or delete; cloud icon indicates DB-persisted vs in-memory-only) |

### Other components

| Component | Description |
| --- | --- |
| `StatusIndicator` | Header badge — LLM connection status and round-trip latency |
| `LanguageSwitcher` | Button that allows you to change the app's language |
| `SettingsMenu` | Header icon button that opens a tabbed modal: **General** (model, options, timeout, Ollama URL, API Key, log level, shutdown timeout — Reset to Defaults + Save), **Template** (per-step accordion editor for system context and prompt suffixes), **RAG** (context limit fields); template changes apply immediately on Save without a page reload |
| `TemplateEditor` | Presentational component used by SettingsMenu's Template tab — renders a scrollable accordion of workflow steps, each with editable `systemContext`, `promptSuffix`, and (when present) `guidedPromptSuffix` textareas |
| `ExportPanel` | Export the artifact as `.txt`, `.pdf` (print dialog with embedded figures), or `.docx` (Word with inventors block and embedded figures); also supports `.md` with YAML frontmatter |
| `AppLoader` | Splash screen shown while the app initialises |

---

## Workflow phases

```
input → working → figures → inventors → preview
```

### Phase 1 — input

`IdeaInputStep` collects:

- **Invention concept** (required) — the base idea, passed to all subsequent prompts
- **Technology domain** (optional) — injected as `Domain:` in the RAG context
- **Constraints / notes** (optional, max 120 chars in context) — additional framing passed to each prompt
- **Context files** (optional) — plain-text reference documents; conditionally enabled when the selected model reports `num_ctx ≥ 16 384`. Injected into prompts up to a 40 000-character total budget.

Calling `startWorkflow()` initialises the `PatentArtifact`, resets all seven steps to `pending`, and advances to the `working` phase.

### Phase 2 — working

Steps 1–7 in sequence. For each step:

1. `StepInputPanel` shows three mode tabs (Auto / Guided / Manual).
2. User picks a mode and triggers generation (or writes manually).
3. `OptionsPanel` displays the three returned options side-by-side.
4. User selects one → `selectOption()` saves it to `artifact.sections` and auto-advances to the next step.
5. When all seven steps are done the workflow transitions automatically to the figures phase.

The user can navigate to any previously completed step via `StepProgress` and regenerate at any time.

### Input modes (per step)

| Mode | Behaviour |
| --- | --- |
| **Auto** | Prompt assembled from the REG system context + RAG artifact context; no user input required |
| **Guided** | User fills structured form fields (defined per module in `workflowTemplates.ts`); fields are interpolated into the prompt before the LLM call |
| **Manual** | User writes the section content directly; `submitManualContent()` is called, no LLM request is made |

### Phase 3 — figures

`FiguresStep` lets the user:
- Upload image files (stored as base64 data URLs)
- Create flowcharts with `DiagramEditor` (exports PNG or JSON)
- Attach existing JSON diagrams (previewed in `JsonViewer`)
- Set a caption for each figure

All figures are embedded as base64 in the exported `.docx`.

### Phase 4 — inventors

`InventorsStep` collects per-inventor details (`name`, `address`, `telephone`, `email`, `citizenship`, `employeeId`) and patent-level metadata (`inventionTitle`, `idfNumber`, `businessGroup`).

### Phase 5 — preview

`PreviewPhase` shows the fully assembled artifact. Each section supports inline editing via `updateSectionContent()`. Export options:

- **Markdown** — full artifact with YAML frontmatter (inventor metadata, model, timestamps)
- **Word (.docx)** — styled document with embedded figures

---

## Keyboard shortcuts

Global shortcuts registered via `useHotkeys` (`@mantine/hooks`). Active on all phases.

| Shortcut | Action |
| --- | --- |
| `Alt+W` | Move focus to the first focusable item in the workflow sidebar |
| `Alt+D` | Move focus to the first draft in the drafts panel |
| `Alt+S` | Save the current workflow state as a draft (`persistDraft`) |
| `Alt+L` | Logout — only available when `VITE_DEMO_OAUTH=true` |

---

## State management (`store/workbench.ts`)

The Zustand store manages the entire application state. It is divided into three logical slices:

### LLM slice

| Field | Type | Description |
| --- | --- | --- |
| `selectedModel` | `string` | Active Ollama model name |
| `availableModels` | `string[]` | Models returned by `GET /models` |
| `modelContextLength` | `number \| null` | `num_ctx` from model's Modelfile (via `GET /models/:name/context`) |
| `llmStatus` | `'ok' \| 'unavailable' \| 'checking'` | Connectivity to Ollama |
| `llmLatency` | `number \| null` | Round-trip latency in ms |
| `appSettings` | `AppSettings` | Persisted runtime configuration: `defaultModel`, `numOptions`, `llmTimeoutMs`, `promptMaxLength`, `ollamaUrl`, `shutdownTimeoutMs`, `logLevel`, `apiKey`; loaded from `GET /settings` on boot, saved via `PUT /settings`, reset via `POST /settings/reset` |
| `template` | `RegTemplate` | Active workflow template (steps, RAG config, workflow order); loaded from `GET /template` on boot; updated in-place via `reinitFromTemplate()` after `saveTemplate()` or `resetTemplate()` |

`checkStatus()` polls `GET /status` and `GET /models` every 30 seconds. When models change, `selectedModel` is updated to the closest match by base name. `loadSettings()` and `loadTemplate()` are called once on app mount; `saveSettings(patch)` merges the patch and persists via `PUT /settings`; `resetSettings()` restores factory defaults via `POST /settings/reset`.

### Workflow slice

| Field | Type | Description |
| --- | --- | --- |
| `workflowPhase` | `WorkflowPhase` | Current phase: `'input' \| 'working' \| 'figures' \| 'inventors' \| 'preview'` |
| `steps` | `WorkflowStep[]` | Array of 7 steps; each tracks `status`, `options`, `selectedOption`, token counts, and input mode state |
| `currentStepIndex` | `number` | Active step (`-1` during input phase) |
| `artifact` | `PatentArtifact \| null` | The draft being assembled |
| `generationStatus` | `'idle' \| 'loading' \| 'success' \| 'error'` | State of the current LLM call |
| `lastError` | `string \| null` | Last generation error message |

Step lifecycle: `pending → input → generating → selecting → done`

Key actions:

| Action | Description |
| --- | --- |
| `startWorkflow(idea, domain, constraints, contextFiles)` | Initialises `PatentArtifact` and transitions to `working` |
| `generateStepOptions(overridePrompt?)` | Assembles full prompt, calls `POST /generate`, parses options |
| `selectOption(option)` | Saves option to `artifact.sections`, advances to next step |
| `cancelGeneration()` | Calls `AbortController.abort()`; step reverts to `input` |
| `regenerateOptions()` | Resets current step to `input` so the user can try again |
| `submitManualContent(content)` | Bypasses LLM; wraps content as a `GeneratedOption` and calls `selectOption` |
| `goToStep(index)` | Navigates to any step; restores an actionable status |
| `updateSectionContent(moduleId, content)` | Inline edit of a previously selected section |
| `resetWorkflow()` | Saves current session, aborts any in-flight request, resets to `input` |

> The `AbortController` for in-progress generations lives at module level (outside Zustand) to avoid triggering re-renders on cancel.

### Sessions slice

| Field | Type | Description |
| --- | --- | --- |
| `sessions` | `WorkflowSession[]` | Session list hydrated from SQLite on app boot; max 20 shown in sidebar |
| `figuresDraft` | `FiguresDraft` | Diagram board nodes/edges and JSON editor text; persisted with each session |

| Action | Description |
| --- | --- |
| `initSessions()` | Fetches `GET /sessions` on boot and populates `sessions[]`; marks all as `persisted: true` |
| `saveCurrentSession()` | Snapshots the current artifact + step states into the in-memory `sessions[]` (no server call); used by `resetWorkflow` and export |
| `persistDraft()` | Full server save — calls `POST /sessions` with figures, board state, nav state; marks session `persisted: true` |
| `loadSession(session)` | Async — fetches `GET /sessions/:id` for persisted sessions (to retrieve figure `dataUrl`s stripped by the list endpoint), then restores artifact, steps, and `figuresDraft` into the store |
| `deleteSession(id)` | Removes from `sessions[]`; calls `DELETE /sessions/:id` if persisted |
| `clearSessions()` | Resets `sessions[]`; calls `DELETE /sessions` if any were persisted |

---

## Template system (`utils/workflowTemplates.ts` + API)

The workflow template is no longer a static file baked into the build. At boot, `loadTemplate()` fetches it from `GET /template` (stored in SQLite). `reinitFromTemplate(t)` then mutates the module-level exports — `WORKFLOW_MODULES`, `WORKFLOW_ORDER`, `SECTION_LABELS_EN`, and the RAG config — in-place, so all existing component references pick up the new template without any import changes or page reload.

`config/reg-templates.json` is the **bundled fallback** used as the initial value before the API responds and as the seed for the DB on first run. Editing it still works for development, but production changes should be made via the Settings → Template tab in the UI.

`WORKFLOW_MODULES` exports one `WorkflowModule` per IDF section. Each module defines:

| Field | Description |
| --- | --- |
| `label` / `description` | Displayed in `StepProgress` and the input panel |
| `systemContext` | REG-pattern system context (Role + Examples + Goal); prepended to every Auto prompt |
| `buildPrompt(artifact)` | Calls `buildArtifactContext()` to assemble the RAG user prompt |
| `guidedFields` | Field definitions rendered as a form in Guided mode |
| `buildGuidedPrompt(artifact, fields)` | Variant of `buildPrompt` that interpolates guided field values |

Full prompt structure (Auto mode):

```
{systemContext}

---

{buildArtifactContext(artifact, moduleId)}

Generate 3 [Section] options...
```

See [docs/reg-rag-algorithms.md](../docs/reg-rag-algorithms.md) for a detailed explanation of the REG and RAG algorithms.

---

## Option parsing (`utils/optionParser.ts`)

`parseOptions(response)` extracts the three options from the LLM response using a regex:

```
/OPTION\s+\d+\s*:\s*\n?([\s\S]*?)(?=OPTION\s+\d+\s*:|$)/gi
```

If fewer than two `OPTION N:` markers are found (e.g. the model ignored the format instruction), the full response is returned as a single option as a fallback. Results are capped at three.

---

## Output sanitization (`utils/sanitize.ts`)

`sanitizeOutput(html)` strips potentially dangerous content from LLM responses before rendering:

- `<script>` tags and their contents
- `javascript:` protocol strings
- Inline event handlers (`on*=...`)
- `<iframe>`, `<embed>`, `<object>` tags

`generateId()` produces a short random identifier used for `GeneratedOption.id`, `FigureItem.id`, and `WorkflowSession.id`.

---

## API layer (`api/client.ts`)

All server communication is centralised in `client.ts`. Functions:

| Function | Method | Endpoint |
| --- | --- | --- |
| `getStatus()` | GET | `/status` |
| `getModels()` | GET | `/models` |
| `getModelContextLength(name)` | GET | `/models/:name/context` |
| `generatePatentContent(req, signal)` | POST | `/generate` |
| `fetchSessions()` | GET | `/sessions` |
| `getSession(id)` | GET | `/sessions/:id` |
| `saveSession(session)` | POST | `/sessions` |
| `deleteSession(id)` | DELETE | `/sessions/:id` |
| `clearAllSessions()` | DELETE | `/sessions` |
| `getSettings()` | GET | `/settings` |
| `updateSettings(settings)` | PUT | `/settings` |
| `resetSettings()` | POST | `/settings/reset` |
| `getTemplate()` | GET | `/template` |
| `updateTemplate(template)` | PUT | `/template` |
| `resetTemplate()` | POST | `/template/reset` |
| `setApiKey(key)` | — | Module-level setter; updates the `x-api-key` header used by all subsequent `apiFetch` calls |

Requests are made relative to `/api` (proxied to `localhost:3001` by Vite during development). `isApiError(result)` is a type guard used across the store and components.

---

## Dev

```bash
npm install
npm run dev    # Vite dev server on localhost:3003/patent-workbench
```

API requests are proxied to `localhost:3001` during development (configured in `vite.config.ts`). The server must be running separately (`npm run server:dev` from the repo root).

The model is selected directly in the UI from the list of models available in the local Ollama instance. See [server/README.md](../server/README.md#recommended-models) for recommended models and setup instructions.

## Build

```bash
npm run build   # Output to dist/ (base path: /patent-workbench)
```
