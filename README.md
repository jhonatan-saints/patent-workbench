# Patent Workbench - Local LLM Assistant for Patent Ideation

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Status](https://img.shields.io/badge/status-active-success)

A local-first visual IDE for patent ideation, drafting, and iteration — powered by local LLMs via [Ollama](https://ollama.com). No cloud, no telemetry, no data leaving your machine.

## What it does

Patent Workbench provides a structured interface for generating the seven canonical sections of a patent application using a local LLM. Each section has a dedicated prompt template built on the REG (Role + Examples + Goal) pattern, which instructs the model to reason like a USPTO patent attorney and produce output that conforms to standard patent language conventions.

### Supported patent sections

| Section | Purpose | Est. tokens |
| --- | --- | --- |
| Title | Concise, descriptive patent title | ~180 |
| Field of Invention | Technical domain classification | ~150 |
| Background | Prior art and problem statement | ~350 |
| Summary | High-level solution overview | ~300 |
| Claims | Independent and dependent claim set | ~450 |
| Detailed Description | Full embodiment description | ~600 |
| Abstract | 150-word summary per USPTO rules | ~200 |

### Key features

- **Template Builder** — structured form inputs fill each section's variables (`{concept}`, `{priorArt}`, `{novelty}`, etc.) and assemble the full prompt automatically.
- **Freeform Prompt mode** — bypass templates and write prompts directly.
- **Model selector** — switch between any Ollama-compatible model (Mistral, Llama3, Llama3.1, Phi3, Gemma2, CodeLlama).
- **Token meter** — live estimate of input and output token counts per section.
- **LLM status indicator** — real-time connectivity check with latency display; polls every 30 seconds.
- **Session history** — in-memory record of up to 50 generations per session; browse, restore, or delete individual entries.
- **Export** — save output as `.md` (with metadata: section, model, timestamp) or `.txt`.
- **Prompt injection protection** — server-side detection and rejection of jailbreak patterns.

## Architecture

```
patent-workbench/
├── client/          # React 18 + Vite + Mantine v7 frontend
├── server/          # Express + TypeScript API (LLM proxy)
├── docs/            # Project documentation
└── scripts/         # Setup and build scripts
```

The client talks exclusively to the Express backend via a typed API layer. The server validates, sanitizes, and forwards requests to Ollama running on `localhost:11434`. The LLM never receives requests directly from the browser.

## Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com) installed and running locally
- At least one model pulled, e.g. `ollama pull mistral`

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

Open [http://localhost:5173](http://localhost:5173). The status indicator in the header will turn green once Ollama is reachable.

## Available scripts

| Script | Description |
| --- | --- |
| `npm run setup` | Install deps for both workspaces |
| `npm start` | Run client and server concurrently |
| `npm run server:dev` | Server in watch mode |
| `npm run client` | Vite dev server |
| `npm run client:build` | Build client to `client/dist/` |
| `npm run lint` | ESLint + Markdown + StyleLint |
| `npm run format` | Prettier |

For server-specific configuration (env vars, endpoints, rate limits) see [server/README.md](server/README.md).
For client architecture details see [client/README.md](client/README.md).

## Contributing

- Open focused, small PRs.
- Run `npm run lint` and `npm run format` before submitting.

## Licensing notes for contributors

- Public repo: client utilities, UI components, generic `workflowTemplates` and tooling are released under **Apache‑2.0**. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
- Proprietary artifacts: the REG algorithm and company/enterprise templates are proprietary and not published here. Those are licensed separately under a commercial EULA (sample: [EULA_PROPRIETARY.md](EULA_PROPRIETARY.md)).

If you plan to contribute code that depends on proprietary artifacts, please open an issue first to discuss a clean separation so public contributions remain license‑compatible.

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
