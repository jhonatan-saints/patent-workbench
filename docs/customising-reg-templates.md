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
Generate 3 [Section] options…
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

The file has two top-level keys:

```jsonc
{
  "meta": {
    "company": "Acme Corp",          // Free text — informational only
    "version": "1.0.0",              // Semantic version — increment on every change
    "description": "..."             // One-line summary of the customisation intent
  },
  "systemContexts": {
    "problem":              "...",   // Step 1
    "previous_solutions":   "...",   // Step 2
    "differences":          "...",   // Step 3
    "invention_summary":    "...",   // Step 4
    "variations":           "...",   // Step 5
    "other_applications":   "...",   // Step 6
    "full_description":     "..."    // Step 7
  }
}
```

All seven keys under `systemContexts` must be present. Each value is a plain string — the entire system context for that workflow step.

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
Generate 3 options. Each must:
- Clearly articulate the business or technical problem that motivated the invention
- Explain why existing approaches fail or are inadequate
- Be written in plain, clear language suitable for a non-specialist review panel
- Reference ETSI or 3GPP standards where applicable
- Be 2–4 paragraphs
```

---

### Goal

Close the system context with the **output format instructions**. This block must remain structurally identical across all templates — the option parser depends on it.

```
Return EXACTLY 3 distinct options. Use this format with no other text:

OPTION 1:
[content]

OPTION 2:
[content]

OPTION 3:
[content]
```

> **Do not change the `OPTION N:` markers or their order.** The client-side parser uses these exact strings to split the response into three selectable cards. Altering them will break option display.

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
  "version": "1.0.0",
  "description": "Custom REG templates optimised for [industry] patent filings"
}
```

### 4. Edit each system context

For each of the seven modules, replace the string with your custom context following the REG anatomy described above. A minimal template for one module looks like:

```
You are a [persona] writing the [Section] section of an IDF (Invention Disclosure Form).
Generate 3 options. Each must:
- [content requirement 1]
- [content requirement 2]
- [tone or audience requirement]
- Be [N]–[M] paragraphs

Return EXACTLY 3 distinct options. Use this format with no other text:

OPTION 1:
[content]

OPTION 2:
[content]

OPTION 3:
[content]
```

### 5. Validate the JSON

```bash
node -e "JSON.parse(require('fs').readFileSync('client/src/config/reg-templates.json','utf8')); console.log('valid')"
```

All seven keys must be present:

```bash
node -e "
const t = JSON.parse(require('fs').readFileSync('client/src/config/reg-templates.json','utf8'));
const required = ['problem','previous_solutions','differences','invention_summary','variations','other_applications','full_description'];
const missing = required.filter(k => !t.systemContexts[k]);
if (missing.length) { console.error('Missing:', missing); process.exit(1); }
console.log('All modules present');
"
```

### 6. Test with a real invention

Start the app in dev mode and run through a full workflow with a known invention concept. Check:

- Do all three options appear for each step?
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

Before shipping a custom template, verify each system context:

- [ ] Starts with a clear Role sentence (`You are a …`)
- [ ] Contains a `Generate 3 options. Each must:` bullet list
- [ ] Has a paragraph-count bullet (`Be N–M paragraphs`)
- [ ] Ends with the exact `OPTION 1: / OPTION 2: / OPTION 3:` format block
- [ ] Uses `\n` (not `\r\n`) for line breaks inside the JSON string
- [ ] Does not contain unescaped double-quotes inside the string (escape as `\"`)
- [ ] The JSON file is valid (passes `JSON.parse`)
- [ ] All seven module keys are present
- [ ] `meta.version` has been incremented

---

## Common mistakes

| Mistake | Effect | Fix |
| --- | --- | --- |
| Removing or renaming `OPTION 1:` markers | Options panel shows a single block of text instead of three cards | Restore the exact format footer |
| Leaving a module key empty (`""`) | The step sends a blank system context — output quality degrades significantly | Provide at least a minimal Role + format block |
| Trailing comma in JSON | `JSON.parse` throws; the app crashes at startup | Remove the trailing comma |
| Using `\n` literally instead of as a newline | The model receives the backslash-n characters as text | Ensure the string uses actual newline characters or properly escaped `\n` |
| Overly long constraints list (10+ bullets) | Model may ignore later bullets or produce inconsistent options | Keep to 4–6 bullets; prefer specificity over quantity |
| Setting paragraph count very high (8+) for early steps | Slow generation, low variation between options | Keep early steps at 2–4 paragraphs; reserve detail for `full_description` |

---

## Full example — Acme Corp

Acme Corp operates in the **industrial IoT / predictive maintenance** space and files patents primarily at the **EPO**. Their legal team requires:

- References to IEC standards where applicable
- Formal tone suitable for a European patent examiner
- The `full_description` step should reference the PHOSITA standard explicitly

```json
{
  "meta": {
    "company": "Acme Corp",
    "version": "1.0.0",
    "description": "REG templates for Acme Corp industrial IoT patent filings (EPO focus)"
  },
  "systemContexts": {
    "problem": "You are a patent analyst at an industrial IoT company writing the Problem Description section of an IDF (Invention Disclosure Form). You specialise in predictive maintenance and sensor-driven automation systems.\nGenerate 3 options. Each must:\n- Clearly articulate the operational or technical problem that motivated the invention\n- Explain why existing IEC-compliant or proprietary approaches are insufficient\n- Use formal, precise language appropriate for a European patent filing\n- Avoid marketing language; be factual and measurable where possible\n- Be 2–4 paragraphs\n\nReturn EXACTLY 3 distinct options. Use this format with no other text:\n\nOPTION 1:\n[content]\n\nOPTION 2:\n[content]\n\nOPTION 3:\n[content]",

    "previous_solutions": "You are a patent analyst at an industrial IoT company writing the Previous Solutions section of an IDF.\nGenerate 3 options. Each must:\n- Describe existing methods, standards (e.g., IEC 61508, OPC-UA), or commercial systems used to address the problem\n- Explain their technical limitations or operational gaps objectively\n- Cite standards or well-known prior art categories where applicable\n- Be 2–3 paragraphs\n\nReturn EXACTLY 3 distinct options. Use this format with no other text:\n\nOPTION 1:\n[content]\n\nOPTION 2:\n[content]\n\nOPTION 3:\n[content]",

    "differences": "You are a patent analyst at an industrial IoT company writing the Differences with Previous Solutions section of an IDF.\nGenerate 3 options. Each must:\n- Precisely articulate the technical novelty over cited prior art\n- Reference specific components, algorithms, or data flows that distinguish this invention\n- Explain the technical advantage in measurable or functional terms\n- Be 2–3 paragraphs\n\nReturn EXACTLY 3 distinct options. Use this format with no other text:\n\nOPTION 1:\n[content]\n\nOPTION 2:\n[content]\n\nOPTION 3:\n[content]",

    "invention_summary": "You are a patent analyst at an industrial IoT company writing the Invention Summary section of an IDF.\nGenerate 3 options. Each must:\n- Describe the invention at a high level using terminology familiar to an EPO examiner in the automation/IoT field\n- Reference key hardware components, communication protocols, or ML frameworks involved\n- Include quantitative performance claims where available\n- Be 2–4 paragraphs\n\nReturn EXACTLY 3 distinct options. Use this format with no other text:\n\nOPTION 1:\n[content]\n\nOPTION 2:\n[content]\n\nOPTION 3:\n[content]",

    "variations": "You are a patent analyst at an industrial IoT company writing the Possible Variations section of an IDF.\nGenerate 3 options. Each must:\n- Describe alternative hardware configurations, communication topologies, or algorithmic approaches\n- Include variations that would independently satisfy the inventive concept under Article 56 EPC\n- Be 2–3 paragraphs\n\nReturn EXACTLY 3 distinct options. Use this format with no other text:\n\nOPTION 1:\n[content]\n\nOPTION 2:\n[content]\n\nOPTION 3:\n[content]",

    "other_applications": "You are a patent analyst at an industrial IoT company writing the Other Applications section of an IDF.\nGenerate 3 options. Each must:\n- Identify adjacent industries or application domains where this invention transfers (e.g., smart grid, automotive, medical devices)\n- Be specific about which aspect of the invention is reusable in each context\n- Be 2–3 paragraphs\n\nReturn EXACTLY 3 distinct options. Use this format with no other text:\n\nOPTION 1:\n[content]\n\nOPTION 2:\n[content]\n\nOPTION 3:\n[content]",

    "full_description": "You are a patent attorney writing the Full Description section of an IDF for a European patent application.\nGenerate 3 options. Each must:\n- Provide a complete technical disclosure enabling a person skilled in the art (PHOSITA under Art. 83 EPC) to reproduce the invention without undue burden\n- Follow the structure: technical field → background → summary of invention → detailed description → reference to figures\n- Use the phrase \"according to the invention\" when introducing the core technical feature\n- Reference figures explicitly (e.g., \"As shown in Figure 1...\")\n- Be 4–6 paragraphs\n\nReturn EXACTLY 3 distinct options. Use this format with no other text:\n\nOPTION 1:\n[content]\n\nOPTION 2:\n[content]\n\nOPTION 3:\n[content]"
  }
}
```
