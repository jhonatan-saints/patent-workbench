# Customising REG Templates — Patent Workbench

This guide explains how to tailor the REG prompt templates for a specific organisation. After reading it you will be able to write, validate, and deploy a custom `reg-templates.json` without touching any application code.

---

## Table of contents

1. [What is a REG template?](#what-is-a-reg-template)
2. [File location and structure](#file-location-and-structure)
3. [Anatomy of a good system context](#anatomy-of-a-good-system-context)
   - [Role](#role)
   - [Examples (constraints)](#examples-constraints)
   - [Goal](#goal)
4. [Module reference](#module-reference)
5. [Step-by-step: writing a custom template](#step-by-step-writing-a-custom-template)
6. [Validation checklist](#validation-checklist)
7. [Common mistakes](#common-mistakes)
8. [Full example — Acme Corp](#full-example--acme-corp)

---

## What is a REG template?

Every IDF workflow step sends the LLM a two-part prompt:

```
[system context]        ← defined by the REG template
---
[artifact context]      ← assembled automatically from the invention data (RAG)
Generate N [Section] options…
```

The **system context** is the REG template. It tells the model:

- **R**ole — who it is (patent analyst, patent attorney, etc.)
- **E**xamples — what the output must look like (format, length, tone)
- **G**oal — what quality standard the output must meet

Changing the system context changes everything: persona, industry terminology, paragraph count, legal jurisdiction emphasis, and output format. No code change is required — only editing the JSON config file.

---

## File location and structure

```
client/src/config/reg-templates.json
```

The file has four top-level keys:

```jsonc
{
  "meta": {
    "company": "Acme Corp",      // Free text — informational only
    "domain": "patent",          // Domain tag — informational only
    "version": "1.0.0",          // Semantic version — increment on every change
    "description": "..."         // One-line summary of the customisation intent
  },

  "rag": {
    "maxPriorSections": 3,        // How many prior sections to inject into each prompt
    "maxContextFileChars": 40000, // Total character budget for uploaded reference documents
    "maxSectionChars": 200,       // Max chars per prior section injected
    "maxIdeaChars": 200,          // Max chars for the base idea field
    "maxConstraintsChars": 120    // Max chars for the constraints/notes field
  },

  "workflow": {
    "order": [                    // Controls step sequence — reorder or remove entries to change the flow
      "problem",
      "previous_solutions",
      "differences",
      "invention_summary",
      "variations",
      "other_applications",
      "full_description"
    ]
  },

  "steps": {
    "problem": {
      "label": "Problem Description",          // Display label (used when labelKey is absent)
      "labelKey": "res_StepProblemDescription", // i18n key — prefix res_ enables translation
      "description": "...",
      "descriptionKey": "...",
      "sectionLabelEn": "Problem Description",  // English label injected into RAG context
      "systemContext": "...",                   // The REG template (Role + constraints)
      "promptSuffix": "...",                    // Auto mode generation instruction
      "guidedFields": [...],                    // Form fields shown in Guided mode
      "guidedPromptSuffix": "..."               // Guided mode generation instruction
    }
    // ... same shape for every step
  }
}
```

All keys listed under `workflow.order` must have a matching entry in `steps`. The `rag` values apply globally across all steps.

### Placeholders

The following placeholders are supported in `systemContext`, `promptSuffix`, and `guidedPromptSuffix`:

| Placeholder | Replaced with |
| --- | --- |
| `{{numOptions}}` | The number of options configured in Settings (default: 3) |
| `{{plural}}` | `""` when numOptions is 1, `"s"` otherwise |
| `{{fields.KEY}}` | Value entered by the user for guided field with key `KEY` (guided prompts only) |

---

## Anatomy of a good system context

A system context string follows the REG pattern: Role → Examples → Goal.

### Role

The first sentence. It declares who the model is and what document section it is writing.

**Pattern:**
```
You are a [persona] writing the [Section Name] section of an IDF (Invention Disclosure Form).
```

**Persona choices and when to use each:**

| Persona | Use for |
| --- | --- |
| `patent analyst` | Steps 1–6. Analytical, factual, technology-focused. |
| `patent attorney` | Step 7 (Full Description). Legal-grade language, PHOSITA enablement (35 U.S.C. §112). |
| `senior R&D engineer at [Company]` | When the organisation wants output grounded in internal engineering vocabulary. |
| `IP specialist in [Industry]` | Strongly domain-specific output (medical devices, fintech, automotive, etc.). |

You may add a one-sentence persona expansion immediately after the role line to provide additional context:

```
You are a patent analyst at a telecommunications company writing the Problem Description
section of an IDF. You specialise in real-time communication systems and network protocols.
```

---

### Examples (constraints)

A bullet list of **what each option must contain or avoid**. This is the most impactful part of the template: it directly controls output structure, scope, and length.

**Required bullets:**
- Exactly one length constraint: `- Be N–M paragraphs`
- At least one content constraint specifying what must be covered
- At least one tone or audience constraint

**Optional but recommended:**
- Domain-specific vocabulary or standards to reference
- Elements to explicitly exclude (`- Do not include legal citations`)
- Internal terminology the model should adopt

**Example block:**
```
Generate {{numOptions}} option{{plural}}. Each must:
- Clearly articulate the business or technical problem that motivated the invention
- Explain why existing approaches fail or are inadequate
- Be written in plain, clear language suitable for a non-specialist review panel
- Reference ETSI or 3GPP standards where applicable
- Be 2–4 paragraphs
```

---

### Goal

The `systemContext` string ends after the constraints list. **Do not include the `OPTION N:` format block** — the engine appends it automatically based on the current `numOptions` setting. Adding it manually will cause it to appear twice and break option display.

The generation instruction ("`Generate N options for this invention.`") lives in the separate `promptSuffix` and `guidedPromptSuffix` fields, not in `systemContext`.

---

## Module reference

| Key | Section name | Default persona | Recommended length |
| --- | --- | --- | --- |
| `problem` | Problem Description | patent analyst | 2–4 paragraphs |
| `previous_solutions` | Previous Solutions | patent analyst | 2–3 paragraphs |
| `differences` | Key Differences | patent analyst | 2–3 paragraphs |
| `invention_summary` | Invention Summary | patent analyst | 2–4 paragraphs |
| `variations` | Possible Variations | patent analyst | 2–3 paragraphs |
| `other_applications` | Other Applications | patent analyst | 2–3 paragraphs |
| `full_description` | Full Description | patent attorney | 4–6 paragraphs |

Reducing the paragraph count produces faster, more concise output. Increasing it produces richer, more detailed text at the cost of latency and token usage.

---

## Step-by-step: writing a custom template

### 1. Identify the customisation goal

Before writing, answer these questions:

- What industry or technology domain does this company operate in?
- Are there internal standards, frameworks, or acronyms the model should know?
- Who reads the IDF output — engineers, lawyers, executives, a review board?
- Is there a jurisdiction emphasis (e.g., USPTO, EPO, UKIPO)?
- Should the tone be formal/legal or technical/engineering?

### 2. Copy the default file

```bash
cp client/src/config/reg-templates.json client/src/config/reg-templates.json.bak
```

Always keep a backup before editing.

### 3. Update the `meta` block

```json
"meta": {
  "company": "Your Company Name",
  "domain": "patent",
  "version": "1.0.0",
  "description": "Custom REG templates optimised for [industry] patent filings"
}
```

### 4. Edit each step

For each module in `steps`, the fields to customise are:

| Field | What to change |
| --- | --- |
| `systemContext` | Role + constraint bullets. Use `{{numOptions}}` and `{{plural}}` placeholders. Do **not** add the format block — it is appended automatically. |
| `promptSuffix` | The auto-mode generation instruction. Keep `{{numOptions}}` and `{{plural}}` so it adapts to Settings. |
| `guidedFields` | Add, remove, or relabel form fields shown in Guided mode. Each entry needs `key`, `label`, `placeholder`, and `type` (`"text"` or `"textarea"`). |
| `guidedPromptSuffix` | The guided-mode generation instruction. Reference guided field values via `{{fields.KEY}}` where `KEY` matches a `guidedFields[].key`. |
| `sectionLabelEn` | The English label used in the RAG context injected into subsequent steps. Change this only if renaming the section. |

A minimal `systemContext` for one module:

```
You are a [persona] writing the [Section] section of an IDF (Invention Disclosure Form).
Generate {{numOptions}} option{{plural}}. Each must:
- [content requirement 1]
- [content requirement 2]
- [tone or audience requirement]
- Be [N]–[M] paragraphs
```

### 5. Validate the JSON

```bash
node -e "JSON.parse(require('fs').readFileSync('client/src/config/reg-templates.json','utf8')); console.log('valid')"
```

Verify all required step keys are present:

```bash
node -e "
const t = JSON.parse(require('fs').readFileSync('client/src/config/reg-templates.json','utf8'));
const required = ['problem','previous_solutions','differences','invention_summary','variations','other_applications','full_description'];
const missing = required.filter(k => !t.steps[k]);
if (missing.length) { console.error('Missing steps:', missing); process.exit(1); }
console.log('All steps present');
"
```

### 6. Test with a real invention

Start the app in dev mode and run through a full workflow with a known invention concept. Check:

- Do all options appear for each step?
- Is the terminology and tone appropriate for the target organisation?
- Are the options the right length?

### 7. Commit and deploy

```bash
git add client/src/config/reg-templates.json
git commit -m "chore: customise REG templates for [Company]"
```

The JSON is compiled into the client bundle at build time — no server-side changes needed.

---

## Validation checklist

Before shipping a custom template, verify each step:

- [ ] `systemContext` starts with a clear Role sentence (`You are a …`)
- [ ] `systemContext` contains a constraints bullet list (`Generate {{numOptions}} option{{plural}}. Each must:`)
- [ ] `systemContext` has a paragraph-count bullet (`Be N–M paragraphs`)
- [ ] `systemContext` does **not** include the `OPTION N:` format block (auto-appended)
- [ ] `promptSuffix` and `guidedPromptSuffix` use `{{numOptions}}` and `{{plural}}` (not hardcoded `3`)
- [ ] Each `{{fields.KEY}}` in `guidedPromptSuffix` has a matching entry in `guidedFields`
- [ ] Uses `\n` (not `\r\n`) for line breaks inside the JSON string
- [ ] Does not contain unescaped double-quotes inside strings (escape as `\"`)
- [ ] The JSON file is valid (passes `JSON.parse`)
- [ ] All step keys in `workflow.order` are present in `steps`
- [ ] `meta.version` has been incremented

---

## Common mistakes

| Mistake | Effect | Fix |
| --- | --- | --- |
| Including the `OPTION N:` format block in `systemContext` | Format block appears twice; options may not parse correctly | Remove the format footer — it is appended automatically |
| Hardcoding `3` in `promptSuffix` instead of `{{numOptions}}` | Step ignores the numOptions setting; always generates 3 regardless of config | Use `{{numOptions}} option{{plural}}` |
| Using `{{fields.KEY}}` with a key not listed in `guidedFields` | Placeholder resolves to empty string silently | Ensure every `{{fields.KEY}}` has a matching `guidedFields[].key` |
| Leaving a step's `systemContext` empty (`""`) | The step sends a blank system context — output quality degrades significantly | Provide at least a minimal Role + constraints block |
| Trailing comma in JSON | `JSON.parse` throws; the app crashes at startup | Remove the trailing comma |
| Overly long constraints list (10+ bullets) | Model may ignore later bullets or produce inconsistent options | Keep to 4–6 bullets; prefer specificity over quantity |
| Setting paragraph count very high (8+) for early steps | Slow generation, low variation between options | Keep early steps at 2–4 paragraphs; reserve detail for `full_description` |

---

## Full example — Acme Corp

Acme Corp operates in the **industrial IoT / predictive maintenance** space and files patents primarily at the **EPO**. Their legal team requires:

- References to IEC standards where applicable
- Formal tone suitable for a European patent examiner
- The `full_description` step should reference the PHOSITA standard explicitly

The example below shows a single step (`problem`) with the full structure. The remaining six steps follow the same shape.

```json
{
  "meta": {
    "company": "Acme Corp",
    "domain": "patent",
    "version": "1.0.0",
    "description": "REG templates for Acme Corp industrial IoT patent filings (EPO focus)"
  },

  "rag": {
    "maxPriorSections": 3,
    "maxContextFileChars": 40000,
    "maxSectionChars": 200,
    "maxIdeaChars": 200,
    "maxConstraintsChars": 120
  },

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

  "steps": {
    "problem": {
      "label": "Problem Description",
      "labelKey": "res_StepProblemDescription",
      "description": "Describe the problem this invention solves",
      "descriptionKey": "res_StepProblemDescription_Desc",
      "sectionLabelEn": "Problem Description",

      "systemContext": "You are a patent analyst at an industrial IoT company writing the Problem Description section of an IDF (Invention Disclosure Form). You specialise in predictive maintenance and sensor-driven automation systems.\nGenerate {{numOptions}} option{{plural}}. Each must:\n- Clearly articulate the operational or technical problem that motivated the invention\n- Explain why existing IEC-compliant or proprietary approaches are insufficient\n- Use formal, precise language appropriate for a European patent filing\n- Avoid marketing language; be factual and measurable where possible\n- Be 2–4 paragraphs",

      "promptSuffix": "Generate {{numOptions}} Problem Description option{{plural}} for this invention.",

      "guidedFields": [
        {
          "key": "pain_point",
          "label": "Core Pain Point",
          "labelKey": "res_GuidedField_PainPoint",
          "placeholder": "e.g., Sensor arrays cannot detect bearing degradation below 5% wear threshold...",
          "placeholderKey": "res_GuidedField_PainPoint_Placeholder",
          "type": "textarea"
        },
        {
          "key": "impact",
          "label": "Business / Operational Impact",
          "labelKey": "res_GuidedField_Impact",
          "placeholder": "e.g., Unplanned downtime costs €40k/hour; current systems miss 30% of early failures...",
          "placeholderKey": "res_GuidedField_Impact_Placeholder",
          "type": "textarea"
        }
      ],

      "guidedPromptSuffix": "Core pain point: {{fields.pain_point}}\nOperational impact: {{fields.impact}}\n\nGenerate {{numOptions}} Problem Description option{{plural}} based on these specifics."
    }
  }
}
```
