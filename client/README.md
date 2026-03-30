# Client — patent-workbench

React + Vite frontend for Patent Workbench. Provides a structured, step-by-step interface for drafting all eight patent sections using a local LLM, with three generated options to compare at each step.

## Stack

- React 18 + TypeScript
- Vite (dev server and bundler)
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- Mantine v7 (UI component library)
- Zustand (state management)
- Tabler Icons
- `docx` (Word document export)

## Structure

```
src/
├── api/            # Typed API client — all server calls go through here
├── components/
│   └── workflow/   # Per-phase and per-step workflow components
├── services/       # LLM client service wrappers
├── store/          # Zustand store (workbench.ts)
├── theme/          # Mantine theme customization
├── types/          # Shared TypeScript type definitions
├── utils/          # workflowTemplates, sanitize, optionParser
├── assets/         # Fonts and icons
├── App.tsx         # Root layout (AppShell + resizable split view)
└── main.tsx        # React entry point (MantineProvider)
```

## Components

### Workflow components (`components/workflow/`)

| Component | Phase | Description |
| --- | --- | --- |
| `IdeaInputStep` | input | Invention idea, domain, and constraints form; launches the workflow |
| `StepProgress` | working | Left sidebar listing all 8 steps with status badges; click to navigate |
| `StepInputPanel` | working | Per-step input panel with Auto / Guided / Manual mode tabs |
| `OptionsPanel` | working | Grid of the three generated options for the current step |
| `OptionCard` | working | Individual option card with select and copy actions |
| `ArtifactPreview` | working | Live right-panel preview of all selected sections so far |
| `InventorsStep` | inventors | Form to add/remove inventors and optional patent metadata |
| `PreviewPhase` | preview | Full artifact review with inline editing and export |
| `SessionsPanel` | all | In-memory session history browser (restore or delete past runs) |

### Other components

| Component | Description |
| --- | --- |
| `StatusIndicator` | Header badge — LLM connection status and round-trip latency |
| `ExportPanel` | Export the artifact as `.md` or `.docx` |
| `AppLoader` | Splash screen shown while the app initialises |

## Workflow phases

```
input → working → inventors → preview
```

1. **input** — `IdeaInputStep` collects the base invention idea, technical domain, and optional constraints.
2. **working** — Steps 1–8 in sequence. For each step the user picks an input mode, generates options, and selects one.
3. **inventors** — `InventorsStep` collects inventor details and optional patent metadata (IDF number, business group).
4. **preview** — `PreviewPhase` shows the fully assembled artifact with inline edit support and export.

### Input modes (per step)

| Mode | Behaviour |
| --- | --- |
| **Auto** | Prompt is assembled automatically from the base idea and prior sections |
| **Guided** | User fills structured form fields; fields are interpolated into the template |
| **Manual** | User writes the section content directly; no LLM call is made |

## State (workbench.ts)

The Zustand store manages the entire application state. Key slices:

- **LLM** — `llmStatus` (`checking` / `ok` / `unavailable`), `llmLatency`, `availableModels`, `selectedModel`; polled every 30 seconds via `checkStatus()`.
- **Workflow** — `workflowPhase`, `steps` (array of 8 `WorkflowStep`), `currentStepIndex`, `artifact` (`PatentArtifact`), `generationStatus`, `lastError`.
- **Sessions** — `sessions` array (max 20); each `WorkflowSession` stores the full artifact, model, total tokens, and per-step input states.

The abort controller for in-progress generations lives at module level (outside Zustand state) to avoid triggering re-renders on cancel.

## Template system

`src/utils/workflowTemplates.ts` exports `WORKFLOW_MODULES` and `WORKFLOW_ORDER`.

Each of the eight modules defines:

- `label` / `description` — displayed in `StepProgress`
- `systemContext` — frames the LLM as a USPTO patent attorney (REG pattern)
- `buildPrompt(artifact)` — assembles the user prompt from the current `PatentArtifact`; prior sections are truncated to 200 characters (last 3 only) to stay within context windows
- `guidedFields` — field definitions rendered as a form by `StepInputPanel` in Guided mode
- `estimatedTokens` — used by the token meter

## Dev

```bash
npm install
npm run dev    # Vite dev server on localhost:3003/patent-workbench
```

API requests are proxied to `localhost:3001` during development (configured in `vite.config.ts`). The server must be running separately.

## Build

```bash
npm run build   # Output to dist/ (base path: /patent-workbench)
```
