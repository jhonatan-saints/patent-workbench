# PATENT WORKBENCH - Local LLM Assistant for Patent Ideation

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Status](https://img.shields.io/badge/status-active-success)

A local-first visual shell for running local LLMs and supporting patent ideation, drafting, and iteration workflows.

Quick summary
- Lightweight backend that forwards requests to a local LLM runner (Ollama or compatible).
- React + Vite client (under development).
- Focused on privacy & local-first workflows — the LLM runs locally and the UI is a thin client.

Repository layout
- `server/` — Express + TypeScript backend (LLM proxy, validation, sanitization, rate limiting).
- `client/` — Vite + React UI (work in progress).
- `docs/` — project documentation.

Getting started (quick)

1. Install dependencies

```bash
npm run setup
```

1. Start locally (dev)

```bash
npm run server:dev    # runs backend in watch mode
npm run client        # runs the frontend dev server
```

Server notes
- The backend expects a local LLM HTTP API (default: `http://localhost:11434`).
- See [server/README.md](server/README.md#) for detailed server setup, env vars, and endpoints.

Client notes
- The client is currently under development. See `client/` for source and frontend scripts.

Contributing
- Open issues or PRs with focused, small changes.
- Run `npm run lint` and `npm run format` before submitting PRs.

License
- MIT

Contact
- <jhonatan.santos@mitel.com>
