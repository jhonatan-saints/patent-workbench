# REG and RAG Algorithms — Patent Workbench

This document explains the two core algorithmic patterns that drive prompt construction in Patent Workbench: the **REG** prompt pattern and the **RAG** context-injection mechanism. Together they are responsible for the quality and coherence of the LLM-generated IDF sections.

---

## Table of contents

1. [Overview](#overview)
2. [REG — Role + Examples + Goal](#reg--role--examples--goal)
   - [Pattern structure](#pattern-structure)
   - [The seven REG contexts](#the-seven-reg-contexts)
   - [Three-option enforcement](#three-option-enforcement)
   - [Option parsing](#option-parsing)
3. [RAG — Retrieval-Augmented Generation](#rag--retrieval-augmented-generation)
   - [What is retrieved](#what-is-retrieved)
   - [Context budget and truncation rules](#context-budget-and-truncation-rules)
   - [Context assembly (`buildArtifactContext`)](#context-assembly-buildartifactcontext)
   - [Context file upload and gating](#context-file-upload-and-gating)
4. [Full prompt assembly](#full-prompt-assembly)
   - [Auto mode](#auto-mode)
   - [Guided mode](#guided-mode)
   - [Manual mode](#manual-mode)
5. [End-to-end example](#end-to-end-example)
6. [Design decisions and trade-offs](#design-decisions-and-trade-offs)

---

## Overview

Every LLM call in Patent Workbench is the product of two complementary mechanisms:

| Mechanism | Responsibility | Lives in |
| --- | --- | --- |
| **REG** | Frames the model's role, demonstrates the expected output structure, and states the quality goal | `systemContext` field of each `WorkflowModule` in `workflowTemplates.ts` |
| **RAG** | Grounds the prompt with invention-specific facts — prior selected sections, inventor details, domain, and user-uploaded reference documents | `buildArtifactContext()` in `workflowTemplates.ts` |

Neither is a trained model or an external retrieval index. Both are deterministic string-building functions executed entirely on the client before the prompt is sent to the server.

---

## REG — Role + Examples + Goal

REG is a **prompt template pattern** that structures the system context prepended to every generated prompt. The name reflects its three components:

| Component | What it does |
| --- | --- |
| **Role** | Tells the model *who* it is for this task (`"You are a patent analyst..."`) |
| **Examples** | Communicates the *format and constraints* expected in the output (bullet rules, paragraph count, output structure) |
| **Goal** | States the *quality target* the output must meet (plain language, objective tone, PHOSITA-enabling detail) |

### Pattern structure

```
You are a [role] writing the [Section] section of an IDF [Invention Disclosure Form].
Generate 3 options. Each must:
- [constraint 1]
- [constraint 2]
- [constraint 3]
- Be [N–M] paragraphs

Return EXACTLY 3 distinct options. Use this format with no other text:

OPTION 1:
[content]

OPTION 2:
[content]

OPTION 3:
[content]
```

The trailing format block (`THREE_OPTIONS_FORMAT`) is a shared constant appended to every system context to enforce the structured output needed by the option parser.

### The seven REG contexts

Each IDF module has a tailored system context. The role shifts from analyst to attorney for the most legally critical section.

| # | Module | Role | Quality constraints |
| --- | --- | --- | --- |
| 1 | Problem Description | Patent analyst | Plain language, 2–4 paras; articulate why existing approaches fail |
| 2 | Previous Solutions | Patent analyst | Objective and factual, 2–3 paras; no disparagement |
| 3 | Key Differences | Patent analyst | Highlight novel technical elements and the advantage conferred, 2–3 paras |
| 4 | Invention Summary | Patent analyst | Accessible language, reference key technologies, include market context if relevant, 2–4 paras |
| 5 | Possible Variations | Patent analyst | Describe alternative embodiments; broaden patent scope, 2–3 paras |
| 6 | Other Applications | Patent analyst | Be specific about technology transfer to each industry/domain, 2–3 paras |
| 7 | Full Description | **Patent attorney** | Enable PHOSITA to practice the invention; include background, core method, implementation details, and figure references, 4–6 paras |

The role for step 7 changes from *analyst* to *attorney* because the Full Description is the most legally consequential section. It must meet the enablement standard (35 U.S.C. § 112) — a person skilled in the art (PHOSITA) must be able to practice the invention from the description alone.

### Three-option enforcement

Every system context ends with the shared `THREE_OPTIONS_FORMAT` constant:

```
Return EXACTLY 3 distinct options. Use this format with no other text:

OPTION 1:
[content]

OPTION 2:
[content]

OPTION 3:
[content]
```

This block appears verbatim in the prompt sent to the model. It is not summarised or paraphrased — the literal format string is required so the option parser can extract the three options reliably.

### Option parsing

The client parses the LLM response in `utils/optionParser.ts` using a single regex:

```ts
const re = /OPTION\s+\d+\s*:\s*\n?([\s\S]*?)(?=OPTION\s+\d+\s*:|$)/gi;
```

This captures the content of each `OPTION N:` block until the next marker or the end of the string. The results are trimmed and capped at three.

**Fallback behaviour:** if fewer than two `OPTION N:` markers are found (e.g. the model ignored the instruction), the entire response is returned as a single option. This prevents a blank UI and lets the user still work with whatever the model produced.

---

## RAG — Retrieval-Augmented Generation

Patent Workbench uses a **document-free, in-memory RAG** approach. There is no vector database, no embedding model, and no similarity search. "Retrieval" means selecting and truncating content from the live `PatentArtifact` object that is already in memory.

The purpose is to give each step's prompt the minimum context needed to stay coherent with earlier decisions, without bloating the prompt beyond the model's context window.

### What is retrieved

Four sources are injected into every prompt (when available):

| Source | Field | Max chars injected | Notes |
| --- | --- | --- | --- |
| Invention concept | `artifact.baseIdea` | 200 | Always present |
| Technology domain | `artifact.baseDomain` | Unlimited (typically short) | Omitted if empty |
| Constraints / notes | `artifact.constraints` | 120 | Omitted if empty |
| Inventor names | `artifact.inventors[].name` | Unlimited (comma-separated) | Omitted if array is empty |
| Prior IDF sections | `artifact.sections[moduleId].content` | 200 per section, last 3 sections only | Only sections completed before the current step |
| Reference documents | `artifact.contextFiles[].content` | 40 000 total across all files | Injected in order; truncated when budget is exhausted |

### Context budget and truncation rules

```
MAX_SECTION_CHARS     = 200    (per prior section)
MAX_PRIOR_SECTIONS    = 3      (sliding window of most recent sections)
MAX_CONTEXT_FILE_CHARS = 40 000 (total across all uploaded files)
```

Prior sections use a **sliding window**: only the three most recently completed sections before the current module are included. For example, when generating step 5 (Possible Variations), the context includes steps 2, 3, and 4 — not step 1. This keeps the prompt compact while ensuring the model has the most relevant prior text.

Reference document content is injected **in insertion order**. A `remaining` counter starts at 40 000; each file's content is sliced to `Math.min(file.content.length, remaining)` and the counter is decremented accordingly. Files beyond the budget are silently skipped.

### Context assembly (`buildArtifactContext`)

**Source:** `client/src/utils/workflowTemplates.ts`

```ts
export function buildArtifactContext(
  artifact: PatentArtifact,
  upToModule?: WorkflowModuleId
): string
```

The `upToModule` parameter determines the sliding window cutoff: only sections with an index strictly less than the current module's index in `WORKFLOW_ORDER` are candidates for inclusion.

**Output format:**

```
Invention: [up to 200 chars of baseIdea]
Domain: [baseDomain]               ← omitted if empty
Notes: [up to 120 chars of constraints]  ← omitted if empty
Inventor(s): Name A, Name B        ← omitted if empty

Prior sections:
[Problem Description] [up to 200 chars]
[Previous Solutions] [up to 200 chars]
[Key Differences] [up to 200 chars]

Reference documents:
[filename1.txt]
[content up to budget]
[filename2.md]
[content up to remaining budget]
```

The output is a plain string — no JSON, no XML. Plain text was chosen because all target models handle it reliably and structured formats introduce parsing overhead with no benefit at this context size.

### Context file upload and gating

Reference documents are uploaded during the `input` phase in `IdeaInputStep`. They are stored as `ContextFile` objects (`{ id, name, content, size }`) in `artifact.contextFiles`.

Upload constraints enforced by the UI:

- **Accepted formats:** `.txt`, `.md`, `.csv`, `.json`, and similar plain-text formats
- **Per-file size limit:** 500 000 bytes
- **Context window gating:** the upload control is only shown when the selected model reports `modelContextLength ≥ 16 384`. This prevents users from injecting 40 KB of reference text into a model running with a 4 096-token context window, which would cause silent truncation of earlier sections.

When `modelContextLength` is `null` (model did not set `num_ctx` explicitly in its Modelfile), the user can manually override the gate and enable context files at their own discretion.

---

## Full prompt assembly

### Auto mode

The complete prompt sent to `POST /generate` in Auto mode:

```
{module.systemContext}

---

{buildArtifactContext(artifact, moduleId)}

Generate 3 [Section] options [for this invention].
```

The `---` separator is a visual divider between the instruction layer (REG) and the data layer (RAG). It has no semantic meaning to the LLM but makes the prompt easier to inspect during debugging.

**Code path:**

```ts
// store/workbench.ts — generateStepOptions()
const prompt = `${module.systemContext}\n\n---\n\n${module.buildPrompt(artifact)}`;
```

```ts
// workflowTemplates.ts — buildPrompt (example: problem module)
buildPrompt: (artifact) =>
  `${buildArtifactContext(artifact, 'problem')}\n\nGenerate 3 Problem Description options for this invention.`,
```

### Guided mode

In Guided mode the user fills a small set of module-specific fields. These values are appended to the RAG context before the generation instruction, providing precise grounding without requiring a full free-text prompt:

```
{module.systemContext}

---

{buildArtifactContext(artifact, moduleId)}
[Field label]: [user value]
[Field label]: [user value]

Generate 3 [Section] options based on these specifics.
```

**Example fields — Problem Description module:**

| Key | Label | Type |
| --- | --- | --- |
| `pain_point` | Core Pain Point | `textarea` |
| `impact` | Business / User Impact | `textarea` |

Each module defines its own `guidedFields` array and a corresponding `buildGuidedPrompt` function. The `StepInputPanel` component renders the fields and passes the collected values to `buildGuidedPrompt` when the user triggers generation.

### Manual mode

No LLM call is made. The user's text is wrapped in a `GeneratedOption` object and passed directly to `selectOption()`, bypassing `generateStepOptions()` entirely:

```ts
// store/workbench.ts — submitManualContent()
const option: GeneratedOption = { id: generateId(), index: 0, content: content.trim() };
get().selectOption(option);
```

---

## End-to-end example

**Scenario:** Generating step 3 (Key Differences) after completing steps 1 and 2. One context file uploaded (`prior_art.txt`, 12 000 chars).

**1. REG system context (Key Differences module):**

```
You are a patent analyst writing the Differences with Previous Solutions section of an IDF.
Generate 3 options. Each must:
- Clearly articulate how this invention differs from prior approaches
- Highlight novel technical elements or methods
- Explain why these differences matter (the advantage they confer)
- Be 2–3 paragraphs

Return EXACTLY 3 distinct options. Use this format with no other text:

OPTION 1:
[content]

OPTION 2:
[content]

OPTION 3:
[content]
```

**2. RAG context (`buildArtifactContext(artifact, 'differences')`):**

```
Invention: Real-time facial expression recognition for pre-call emotional state detectio…
Domain: Contact centre / telecommunications
Notes: Must run on-device with <50ms latency using ONNX runtime

Prior sections:
[Problem Description] Agents cannot determine a customer's emotional state before a cal…
[Previous Solutions] Current systems rely on IVR menus and caller-ID history. These app…

Reference documents:
[prior_art.txt]
US10,XXX,XXX describes a server-side sentiment analysis pipeline that processes… [12 000 chars]
```

**3. Full prompt sent to `POST /generate`:**

```
[REG system context]

---

[RAG context above]

Generate 3 options explaining how this invention differs from previous solutions.
```

**4. LLM response:**

```
OPTION 1:
The present invention departs fundamentally from server-side approaches by performing...

OPTION 2:
Unlike prior art systems that rely on post-call sentiment scoring, this invention...

OPTION 3:
The key differentiator lies in the on-device ONNX inference pipeline, which enables...
```

**5. `parseOptions()` extracts three strings → displayed in `OptionsPanel` as three `OptionCard` components.**

**6. User selects Option 2 → `selectOption()` saves content to `artifact.sections.differences` → workflow advances to step 4.**

**7. Step 4 (Invention Summary) will now include `[Key Differences]` in its sliding window of prior sections.**

---

## Design decisions and trade-offs

| Decision | Rationale |
| --- | --- |
| **Plain-text prompt, no JSON schema** | All target Ollama models (Mistral, Llama 3, Phi-3, Gemma 2) handle plain-text instructions reliably. JSON schema output requires models with strong instruction-following, which is not guaranteed for quantised local models. |
| **Sliding window of 3 prior sections** | Balances context relevance against prompt length. Including all prior sections would grow the prompt by ~1 400 chars by step 7 (7 × 200), increasing latency and risk of truncation on lower-context models. |
| **200-char truncation per section** | Prior sections serve as grounding signals, not full content re-injection. 200 chars is enough to anchor the model to the tone and subject without reproducing the entire selected option. |
| **40 000-char total budget for context files** | Sized to fit comfortably in a 16 384-token context window alongside the system context and generation instruction. Assumes ~4 chars per token on average. |
| **Context file gate at `num_ctx ≥ 16 384`** | A 4 096-token context window cannot accommodate a 40 KB reference document without truncating the system context or prior sections. The gate prevents silent quality degradation. |
| **Client-side prompt assembly** | Keeps proprietary REG system contexts out of server logs and makes the prompt pipeline inspectable and modifiable without a server restart. |
| **No vector store or embeddings** | The reference document corpus per session is small (a few files, <500 KB each). Full-text injection is simpler, deterministic, and avoids a dependency on an embedding model running locally alongside Ollama. |
| **Regex-based option parser with fallback** | The model may not always follow the `OPTION N:` format, especially smaller quantised models. The fallback (full response as one option) prevents a broken UI and keeps the workflow usable even when the model underperforms. |
