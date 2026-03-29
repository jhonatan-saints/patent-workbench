# Client — patent-workbench

React + Vite frontend for Patent Workbench. Provides a structured interface for drafting patent sections using a local LLM.

## Stack

- React 18 + TypeScript
- Vite (dev server and bundler)
- Mantine v7 (UI components)
- Zustand (state management)
- Tabler Icons

## Structure

```
src/
├── api/           # Typed API client — all server calls go through here
├── components/    # UI components (see below)
├── store/         # Zustand store (workbench.ts)
├── types/         # Shared TypeScript types
├── utils/         # Template definitions, sanitization helpers
└── main.tsx
```

## Components

| Component | Description |
| --- | --- |
| `SectionSelector` | Left panel — lists the 7 patent sections and a custom mode |
| `TemplateBuilder` | Form inputs for each section's template variables |
| `PromptInput` | Textarea for freeform prompts; model selector; Generate button |
| `ResultDisplay` | Shows LLM output, loading skeletons, and error alerts |
| `HistoryPanel` | Right panel — browse, restore, or delete past generations |
| `ExportPanel` | Export output as `.md` or `.txt` |
| `StatusIndicator` | Header badge — LLM connection status and latency |
| `TokenMeter` | Estimated token count for current input and output |

## State (workbench.ts)

The Zustand store manages the entire application state:

- LLM connectivity status (checking / online / offline) — polled every 30 seconds
- Available models and currently selected model
- Current section, prompt, and generation result
- Session history (max 50 records; each record stores section, prompt, response, model, timestamp, token counts)

## Template system

`src/utils/templates.ts` defines one REG (Role + Examples + Goal) prompt template per patent section. Each template has:

- A system context that frames the LLM as a USPTO patent attorney
- A user template with named placeholders (`{concept}`, `{priorArt}`, `{novelty}`, `{elements}`, etc.)
- A token estimate used by the TokenMeter component

`TemplateBuilder` renders the placeholders as labelled form fields and assembles the final prompt before submission.

## Dev

```bash
npm install
npm run dev    # Vite dev server on localhost:5173
```

API requests are proxied to `localhost:3001` during development (configured in `vite.config.ts`). The server must be running separately.

## Build

```bash
npm run build   # Output to dist/
```
