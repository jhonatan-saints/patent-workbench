# Patent Workbench — Local LLM Assistant for Patent Ideation

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Status](https://img.shields.io/badge/status-active-success)

A local-first visual IDE for patent ideation, drafting, and iteration — powered by local LLMs via [Ollama](https://ollama.com). No cloud, no telemetry, no data leaving your machine.

## What it does

Patent Workbench guides you through a structured, seven-step workflow to produce a complete patent application draft. Each step uses a dedicated prompt template built on the REG (Role + Examples + Goal) pattern, instructing the model to reason like a USPTO patent analyst/attorney and produce output that conforms to standard patent language conventions.

For every step the LLM generates three distinct options to choose from. You pick the one that best fits your intent — or regenerate — before moving to the next section.

### Workflow

| # | Step | Purpose | Est. tokens |
| --- | --- | --- | --- |
| 1 | Problem Description | Describe the problem the invention addresses and its impact | ~250 |
| 2 | Previous Solutions | Summarize existing approaches and limitations | ~250 |
| 3 | Key Differences | Explain how the invention differs from prior art (novel elements) | ~200 |
| 4 | Invention Summary | High-level overview of the invention and key technologies | ~300 |
| 5 | Possible Variations | Alternative embodiments and broadened scope suggestions | ~200 |
| 6 | Other Applications | Additional use cases and domain transfer opportunities | ~180 |
| 7 | Full Description | Complete technical description enabling a person skilled in the art | ~600 |

### Workflow phases

```
input → working (steps 1–7) → inventors → preview / export
```

- **input** — Enter invention idea, technical domain, and optional constraints.
- **working** — Step through the seven modules; for each step pick auto, guided, or manual input mode.
- **inventors** — Add inventor details (name, address, citizenship, employee ID, etc.) and optional patent metadata (IDF number, business group).
- **preview** — Review the complete assembled artifact, edit any section inline, and export.

### Key features

- **Three-option selection** — every generation returns three distinct options to compare and choose from.
- **Input modes** — per step: *Auto* (fully LLM-driven), *Guided* (fill structured form fields), or *Manual* (write freeform text directly).
- **Model selector** — switch between any Ollama-compatible model (Mistral, Llama 3, Phi-3, Gemma 2, CodeLlama, …).
- **Token meter** — live prompt + completion token counts per step.
- **LLM status indicator** — real-time connectivity check with latency; polls every 30 seconds.
- **Session history** — in-memory record of up to 20 completed sessions; browse, restore, or delete.
- **Export** — save as `.md` (with metadata) or `.docx` (Word document).
- **Prompt injection protection** — server-side detection and rejection of jailbreak patterns.
- **Cancellation** — cancel an in-progress generation at any time.

## Architecture

```
patent-workbench/
├── client/          # React 18 + Vite + Mantine v7 + Tailwind CSS frontend
├── server/          # Express + TypeScript API (LLM proxy)
├── docs/            # Project documentation
└── scripts/         # Setup and build scripts
```

The client talks exclusively to the Express backend via a typed API layer. The server validates, sanitizes, and forwards requests to Ollama running on `localhost:11434`. The LLM never receives requests directly from the browser.

## Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) installed and running locally
- At least one model pulled, e.g. `ollama pull mistral`

## Ollama setup

### Security — keep Ollama local

Ollama must run exclusively on localhost. Never expose it to the network or enable cloud features while using Patent Workbench, as prompts contain confidential invention disclosures.

In the **Ollama desktop app settings**, make sure the following options are **disabled**:

- **Expose Ollama to the network** — keeps the API bound to `127.0.0.1` only; disabling this prevents other machines on the network from reaching your local models.
- **Cloud** — disables any cloud-assisted features or telemetry that could transmit prompt data externally.
- **Auto-download models** — prevents Ollama from silently pulling models in response to API requests; models must be pulled explicitly with `ollama pull <model>`.

### Context length recommendations

Each full workflow run accumulates up to ~2 500 tokens of context. Set `num_ctx` according to available RAM so the model does not silently truncate prior sections. Current recommended mappings:

| Available memory | Recommended `num_ctx` | Notes |
| --- | --- | --- |
| 16 GB RAM | 4 096 | Minimum viable; may still truncate on the last steps for very large prompts |
| 32 GB RAM | 8 192 – 16 384 | Ideal for most workflows — covers full workflow comfortably for larger models |
| 64 GB RAM or more | &gt;16 384 | For extremely large context lengths (above 16 384 tokens) or very large models |

Apply the setting in your `~/.ollama/config.json` (or `%USERPROFILE%\.ollama\config.json` on Windows):

```json
{
  "num_ctx": 4096
}
```

Or pass it per-request via the Ollama CLI when running a model (example uses the minimum recommended `num_ctx`):

```bash
ollama run mistral --num_ctx 4096
```

Running with a `num_ctx` smaller than the accumulated prompt length causes silent truncation. If generated output starts losing context from earlier steps, increase this value or use a quantised model that fits a larger context into the same memory budget.

## Getting started

```bash
# Install all dependencies (client + server)
npm run setup

# Start both dev servers concurrently
npm start
```

Or run them separately:

```bash
npm run server:dev   # Express on localhost:3001 (watch mode)
npm run client       # Vite on localhost:3003/patent-workbench
```

Open [http://localhost:3003/patent-workbench](http://localhost:3003/patent-workbench). The status indicator in the header turns green once Ollama is reachable.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run setup` | Install deps for both workspaces |
| `npm start` | Run client and server concurrently |
| `npm run server:dev` | Server in watch mode |
| `npm run client` | Vite dev server on `localhost:3003` |
| `npm run client:build` | Build client to `client/dist/` |
| `npm run lint` | ESLint + Markdown + StyleLint |
| `npm run format` | Prettier |

For server-specific configuration (env vars, endpoints, rate limits) see [server/README.md](server/README.md).
For client architecture details see [client/README.md](client/README.md).

## Contributing

- Open focused, small PRs.
- Run `npm run lint` and `npm run format` before submitting.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

## Licensing notes for contributors

- Public repo: client utilities, UI components, generic `workflowTemplates` and tooling are released under **Apache-2.0**. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
- Proprietary artifacts: the REG algorithm and company/enterprise templates are proprietary and not published here. Those are licensed separately under a commercial EULA (sample: [EULA_PROPRIETARY.md](EULA_PROPRIETARY.md)).

If you plan to contribute code that depends on proprietary artifacts, please open an issue first to discuss a clean separation so public contributions remain license-compatible.

## Licensing

This project is split between open-source components and proprietary enterprise components:

- **Open-source (client utilities, UI, generic templates, and tooling):**
  Released under the Apache-2.0 license. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
- **Proprietary (REG algorithm and enterprise templates):**
  The core REG algorithm and company-specific template packages are proprietary and are not included in the public repository. Enterprise deployments and those proprietary artifacts are licensed separately under a commercial EULA. See [EULA_PROPRIETARY.md](EULA_PROPRIETARY.md) for a sample of the proprietary license used for private packages.

If you are interested in an on-premise enterprise license, a POC, or a private build that includes the REG algorithm and enterprise templates, please contact the maintainers.

## Contact

- <wazinsky@outlook.com>
- <jhonatan.santos@mitel.com>
