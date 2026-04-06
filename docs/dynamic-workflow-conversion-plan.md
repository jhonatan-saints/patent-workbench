# Conversion Plan — Dynamic Workflow via `reg-templates.json`

**Goal:** make the workflow fully configurable through `client/src/config/reg-templates.json`, removing every hard dependency on step IDs, labels, guided fields, and RAG parameters from the source code. The result is an app that adapts to any domain (legal, medical, technology, industrial) by swapping a single configuration file — no code changes required.

---

## Table of contents

1. [Current state — diagnosis](#1-current-state--diagnosis)
2. [Target architecture](#2-target-architecture)
3. [New `reg-templates.json` schema](#3-new-reg-templatesjson-schema)
4. [Conversion phases](#4-conversion-phases)
   - [Phase 1 — TypeScript types](#phase-1--typescript-types)
   - [Phase 2 — New JSON schema with loader](#phase-2--new-json-schema-with-loader)
   - [Phase 3 — REG + RAG engine in `workflowTemplates.ts`](#phase-3--reg--rag-engine-in-workflowtemplatests)
   - [Phase 4 — Store (`workbench.ts`)](#phase-4--store-workbenchts)
   - [Phase 5 — Components](#phase-5--components)
   - [Phase 6 — i18n for dynamic steps](#phase-6--i18n-for-dynamic-steps)
   - [Phase 7 — Persisted session compatibility](#phase-7--persisted-session-compatibility)
5. [Impacted files — summary](#5-impacted-files--summary)
6. [Risks and design decisions](#6-risks-and-design-decisions)

---

## 1. Current state — diagnosis

### What is hardcoded today

| Hardcoded item | Location | Problem |
| --- | --- | --- |
| `WorkflowModuleId` (union of 7 literals) | `types/index.ts:36` | Adding any new step requires a type change |
| `WORKFLOW_ORDER` (literal array) | `workflowTemplates.ts:18` | Step order is static |
| `WORKFLOW_MODULES` (Record with 7 modules) | `workflowTemplates.ts:128` | Labels, descriptions, guided fields, and `systemContext` are all code |
| `SECTION_LABELS_EN` | `workflowTemplates.ts:77` | EN strings for the RAG context builder are hardcoded |
| `MODULE_RESOURCE_KEYS` and `MODULE_DESCRIPTION_RESOURCE_KEYS` | `workflowTemplates.ts:98–116` | i18n maps hardcoded |
| `MAX_PRIOR_SECTIONS = 3` and `MAX_CONTEXT_FILE_CHARS = 40_000` | `workflowTemplates.ts:28–30` | RAG parameters are not configurable |
| `reg-templates.json` only stores `systemContexts` | `config/reg-templates.json` | Not loaded at runtime; labels, guided fields, and RAG parameters live outside it |

### Components that depend on the static modules

```
store/workbench.ts                        WORKFLOW_ORDER, WORKFLOW_MODULES
components/workflow/StepProgress.tsx      MODULE_RESOURCE_KEYS
components/workflow/StepInputPanel.tsx    WORKFLOW_MODULES, WORKFLOW_ORDER
components/workflow/ArtifactPreview.tsx   WORKFLOW_ORDER, MODULE_RESOURCE_KEYS
components/workflow/PreviewPhase.tsx      WORKFLOW_ORDER, SECTION_LABELS
components/workflow/DraftsPanel.tsx       WORKFLOW_ORDER
components/ExportPanel.tsx                WORKFLOW_ORDER, MODULE_RESOURCE_KEYS
```

---

## 2. Target architecture

```
reg-templates.json
  └── defines: workflow.steps{}, workflow.order[], rag config
        │
        ▼
workflowTemplates.ts  (pure loader + engine)
  ├── loads JSON via Vite static import
  ├── exports WORKFLOW_ORDER: string[]
  ├── exports WORKFLOW_MODULES: Record<string, WorkflowModule>
  ├── buildArtifactContext()   ← RAG engine (parameters from JSON)
  ├── buildPrompt()            ← generic, per step
  └── buildGuidedPrompt()      ← generic, per step
        │
        ▼
store + components  (consume the public API — no logic changes)
```

The JSON becomes the **single source of truth** for the workflow. Switching domain = swapping the JSON file.

---

## 3. New `reg-templates.json` schema

```jsonc
{
  "meta": {
    "company": "Acme Corp",
    "domain": "patent",           // used to personalise generic UI messages
    "version": "2.0.0",
    "description": "..."
  },

  // RAG algorithm parameters — configurable per template
  "rag": {
    "maxPriorSections": 3,        // how many prior sections to inject into context
    "maxContextFileChars": 40000, // total character budget for context files
    "maxSectionChars": 200,       // truncation limit per injected section
    "maxIdeaChars": 200,
    "maxConstraintsChars": 120
  },

  // Step execution order — references IDs defined in "steps"
  "workflow": {
    "order": [
      "problem",
      "previous_solutions",
      "differences",
      "invention_summary",
      "variations",
      "other_applications",
      "full_description"
    ]
  },

  // Full definition of each step
  "steps": {
    "problem": {
      // Label shown in the UI — supports an i18n key OR a literal string
      "label": "Problem Description",
      "labelKey": "res_StepProblemDescription",        // optional; overrides "label" via t() when present

      "description": "Describe the problem this invention solves",
      "descriptionKey": "res_StepProblemDescription_Desc",

      // EN string used by the RAG engine to identify this section in injected context
      "sectionLabelEn": "Problem Description",

      // REG system context — {{numOptions}} is replaced at runtime
      "systemContext": "You are a patent analyst writing the Problem Description section of an IDF.\nGenerate {{numOptions}} options. Each must:\n- Clearly articulate the business or technical problem\n- Explain why existing approaches fail\n- Be written in plain language\n- Be 2–4 paragraphs\n\nReturn EXACTLY {{numOptions}} distinct options. Use this format:\n\nOPTION 1:\n[content]\n\nOPTION 2:\n[content]\n\nOPTION 3:\n[content]",

      // Auto mode user-prompt suffix — {{numOptions}} and {{plural}} replaced at runtime
      "promptSuffix": "Generate {{numOptions}} Problem Description option{{plural}} for this invention.",

      // Guided mode fields — empty array disables the Guided tab for this step
      "guidedFields": [
        {
          "key": "pain_point",
          "label": "Core Pain Point",
          "labelKey": "res_GuidedField_PainPoint",           // optional
          "placeholder": "e.g., Agents cannot determine customer emotional state...",
          "placeholderKey": "res_GuidedField_PainPoint_Placeholder", // optional
          "type": "textarea"
        },
        {
          "key": "impact",
          "label": "Business / User Impact",
          "labelKey": "res_GuidedField_Impact",
          "placeholder": "e.g., Leads to suboptimal call routing...",
          "placeholderKey": "res_GuidedField_Impact_Placeholder",
          "type": "textarea"
        }
      ],

      // Guided prompt suffix — {{fields.KEY}}, {{numOptions}}, {{plural}} replaced at runtime
      "guidedPromptSuffix": "Core pain point: {{fields.pain_point}}\nBusiness impact: {{fields.impact}}\n\nGenerate {{numOptions}} Problem Description option{{plural}} based on these specifics."
    }

    // ... remaining steps follow the same schema
  }
}
```

### Placeholder conventions

| Placeholder | Replaced with |
| --- | --- |
| `{{numOptions}}` | `appSettings.numOptions` (number) |
| `{{plural}}` | `""` when `numOptions === 1`, `"s"` otherwise |
| `{{fields.KEY}}` | Value of the guided field with key `KEY` |

---

## 4. Conversion phases

### Phase 1 — TypeScript types

**File:** `client/src/types/index.ts`

**Main change:** `WorkflowModuleId` changes from a literal union to `string`.

```typescript
// BEFORE
export type WorkflowModuleId =
  | 'problem'
  | 'previous_solutions'
  | 'differences'
  | 'invention_summary'
  | 'variations'
  | 'other_applications'
  | 'full_description';

// AFTER
export type WorkflowModuleId = string;
```

**Cascade impact:**

- `PatentArtifact.sections: Partial<Record<string, ArtifactSection>>` — no functional change, the type simply relaxes
- `WorkflowStep.moduleId: string` — no functional change
- `WorkflowSession.stepInputStates[].moduleId: string` — backwards compatible with persisted sessions

**Note:** TypeScript will lose exhaustive switch/case checking over `WorkflowModuleId`. Compensate with integration tests and JSON schema validation in Phase 2.

---

### Phase 2 — New JSON schema with loader

**File:** `client/src/config/reg-templates.json`

Rewrite with the full schema described in Section 3. Critical points:

1. **Keep the current 7 steps** in the first version — same IDs, same i18n keys. This ensures already-persisted sessions remain compatible.
2. **Add the `rag` section** with the current values (`maxPriorSections: 3`, `maxContextFileChars: 40000`, etc.).
3. **Each step must have `sectionLabelEn`** — this string is used by the RAG engine when building injected prior-section context (currently lives in `SECTION_LABELS_EN` in source code).

---

### Phase 3 — REG + RAG engine in `workflowTemplates.ts`

This file changes from a "data repository" to a "pure engine".

#### 3.1 — Import the JSON

```typescript
import templates from '@/config/reg-templates.json';
```

Vite supports static JSON imports natively — no `fetch` or dynamic import needed.

#### 3.2 — Placeholder substitution

```typescript
function applyPlaceholders(
  template: string,
  numOptions: number,
  fields?: Record<string, string>
): string {
  let result = template
    .replace(/\{\{numOptions\}\}/g, String(numOptions))
    .replace(/\{\{plural\}\}/g, numOptions === 1 ? '' : 's');

  if (fields) {
    result = result.replace(/\{\{fields\.(\w+)\}\}/g, (_, key) => fields[key] ?? '');
  }

  return result;
}
```

#### 3.3 — Derive `WORKFLOW_ORDER` and `WORKFLOW_MODULES` from JSON

```typescript
export const WORKFLOW_ORDER: string[] = templates.workflow.order;

export const WORKFLOW_MODULES: Record<string, WorkflowModule> = Object.fromEntries(
  Object.entries(templates.steps).map(([id, step]) => [
    id,
    {
      label: step.label,
      description: step.description,
      labelKey: step.labelKey,
      descriptionKey: step.descriptionKey,
      systemContext: (numOptions: number) =>
        applyPlaceholders(step.systemContext, numOptions),
      buildPrompt: (artifact: PatentArtifact, numOptions: number) =>
        `${buildArtifactContext(artifact, id)}\n\n${applyPlaceholders(step.promptSuffix, numOptions)}`,
      guidedFields: step.guidedFields ?? [],
      buildGuidedPrompt: (artifact: PatentArtifact, fields: Record<string, string>, numOptions: number) =>
        `${buildArtifactContext(artifact, id)}\n\n${applyPlaceholders(step.guidedPromptSuffix, numOptions, fields)}`,
    } satisfies WorkflowModule,
  ])
);
```

#### 3.4 — RAG parameters from JSON

```typescript
const RAG = templates.rag;

const MAX_PRIOR_SECTIONS     = RAG.maxPriorSections;
const MAX_CONTEXT_FILE_CHARS = RAG.maxContextFileChars;
const MAX_SECTION_CHARS      = RAG.maxSectionChars;
```

`buildArtifactContext` uses these constants instead of hardcoded literals.

#### 3.5 — `SECTION_LABELS_EN` derived from JSON

```typescript
const SECTION_LABELS_EN: Record<string, string> = Object.fromEntries(
  Object.entries(templates.steps).map(([id, step]) => [id, step.sectionLabelEn])
);
```

#### 3.6 — `MODULE_RESOURCE_KEYS` and `MODULE_DESCRIPTION_RESOURCE_KEYS`

```typescript
export const MODULE_RESOURCE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(templates.steps).map(([id, step]) => [id, step.labelKey ?? step.label])
);

export const MODULE_DESCRIPTION_RESOURCE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(templates.steps).map(([id, step]) => [id, step.descriptionKey ?? step.description])
);
```

> When `labelKey` is absent the system uses the `label` string directly — this supports templates with no i18n requirement (single-language enterprise scenario).

---

### Phase 4 — Store (`workbench.ts`)

No logic changes required. The store already consumes `WORKFLOW_ORDER` and `WORKFLOW_MODULES` as imported variables — with Phase 3 exports maintaining the same public interface, the store compiles without modification.

**One thing to verify:** `INITIAL_STEPS` at `workbench.ts:49` reads `WORKFLOW_MODULES[moduleId].label` and `.description`. The new loader keeps both fields on the module object — no change needed.

---

### Phase 5 — Components

#### `StepProgress.tsx` (line 158)

```typescript
// BEFORE — assumes moduleId is always a key of MODULE_RESOURCE_KEYS
{t(MODULE_RESOURCE_KEYS[step.moduleId as WorkflowModuleId]).toUpperCase()}

// AFTER — no cast; falls back to the literal label if no i18n key exists
{resolveLabel(step.moduleId, t).toUpperCase()}
```

Add the `resolveLabel` utility function:

```typescript
// in workflowTemplates.ts or utils/i18n.ts
export function resolveLabel(moduleId: string, t: (key: string) => string): string {
  const key = MODULE_RESOURCE_KEYS[moduleId];
  if (!key) return moduleId; // fallback: show the raw ID if nothing is found
  // If the key looks like a res_ key, translate it; otherwise use it literally
  return key.startsWith('res_') ? t(key) : key;
}
```

#### `StepInputPanel.tsx` — guided fields

`guidedFields` already come from `module.guidedFields` — no change. The only addition: hide the Guided tab automatically when a step has no fields:

```typescript
// Hide the Guided tab if the step defines no guided fields
const hasGuidedFields = module.guidedFields.length > 0;
```

#### `PreviewPhase.tsx`, `ArtifactPreview.tsx`, `DraftsPanel.tsx`, `ExportPanel.tsx`

All iterate over `WORKFLOW_ORDER` — no change, as `WORKFLOW_ORDER` remains an exported `string[]`.

One update needed: `SECTION_LABELS[moduleId]` in `PreviewPhase.tsx` currently returns an i18n key. Replace with `resolveLabel(moduleId, t)` to support both i18n keys and literal strings.

---

### Phase 6 — i18n for dynamic steps

**Scenario A — Template uses existing i18n keys** (the current 7 steps):
- `labelKey: "res_StepProblemDescription"` → `t(labelKey)` resolves normally
- No changes to locale files

**Scenario B — Template defines new steps with literal labels**:
- `labelKey` absent or not starting with `res_`
- `resolveLabel` returns the `label` string directly
- No locale file update required — the label is always shown in the template's language

**Scenario C — Template in an alternative language with full i18n**:
- Add new `res_Custom*` keys to locale files
- Reference them in `labelKey` as usual

---

### Phase 7 — Persisted session compatibility

Sessions saved to SQLite store `moduleId` as a string. When loading a session:

1. If `moduleId` exists in `WORKFLOW_MODULES` → load normally
2. If `moduleId` **does not** exist (e.g. the template was changed) → the step is marked `done` with content preserved, but without the ability to regenerate

Implement in `loadSession()` in the store:

```typescript
const orphanedModules = session.stepInputStates
  ?.filter(s => !WORKFLOW_MODULES[s.moduleId])
  .map(s => s.moduleId) ?? [];

if (orphanedModules.length > 0) {
  console.warn('Session contains steps not in current workflow:', orphanedModules);
  // Show a non-blocking warning in the UI or preserve content as a read-only "orphaned section"
}
```

**Recommendation:** include `"version"` in the JSON `meta` and save the template version alongside each session. If versions differ on load, display a non-blocking warning.

---

## 5. Impacted files — summary

| File | Type of change | Complexity |
| --- | --- | --- |
| `client/src/types/index.ts` | `WorkflowModuleId = string` | Low |
| `client/src/config/reg-templates.json` | Full schema rewrite | Medium |
| `client/src/utils/workflowTemplates.ts` | Rewrite: pure loader + engine | High |
| `client/src/store/workbench.ts` | No changes expected | — |
| `components/workflow/StepProgress.tsx` | `resolveLabel()` instead of cast | Low |
| `components/workflow/StepInputPanel.tsx` | Hide Guided tab when no fields defined | Low |
| `components/workflow/PreviewPhase.tsx` | `resolveLabel()` for section headings | Low |
| `components/workflow/ArtifactPreview.tsx` | No changes expected | — |
| `components/workflow/DraftsPanel.tsx` | No changes expected | — |
| `components/ExportPanel.tsx` | `resolveLabel()` in .docx/.md headings | Low |
| `store/workbench.ts` → `loadSession` | Orphaned `moduleId` validation | Low |

---

## 6. Risks and design decisions

### Risk 1 — Static JSON import freezes the template at build time

Vite imports JSON as an ES module — the file is bundled at build time. Changing the JSON requires a new build.

**Implication:** For clients that need to swap templates without a rebuild, use `fetch('/config/reg-templates.json')` with async loading in the store (similar to `loadSettings()`), instead of a static import.

**Recommended decision:** For the current use case (file committed in the repo), a static import is sufficient and simpler. Document the limitation.

### Risk 2 — `{{fields.KEY}}` injection in `guidedPromptSuffix`

If a JSON template field receives malicious user input, `applyPlaceholders` injects it literally into the prompt. Server-side sanitisation already handles this (`sanitize.ts`), but on the client there is a prompt injection risk via guided fields.

**Recommended decision:** Truncate each guided field value to the same limit applied to sections (`MAX_SECTION_CHARS`) before interpolation.

### Risk 3 — TypeScript loses exhaustive checking over `WorkflowModuleId`

With `type WorkflowModuleId = string`, switch/case without a default branch is no longer caught by the compiler.

**Mitigation:** Add a schema validator in `workflowTemplates.ts` that throws in development if the imported JSON does not satisfy the expected structure (`zod` or a manual assertion in the module).

### Risk 4 — Steps without `guidedFields` crash `StepInputPanel`

If `guidedFields` is `undefined` (field omitted from the JSON), `module.guidedFields.length` throws.

**Mitigation:** Already covered in Phase 3 with `step.guidedFields ?? []` in the loader.

### Design decision — `promptSuffix` vs full `buildPrompt` in JSON

The proposed schema places only the **suffix** of the user prompt in the JSON (`promptSuffix`); the prefix (RAG context) is still built by the engine. This prevents template authors from needing to know the internal RAG format — the JSON only needs to express the final instruction to the model.

A more powerful alternative (but more complex): place the entire user prompt in the JSON with an `{{artifactContext}}` placeholder. Reserve for a future version.
