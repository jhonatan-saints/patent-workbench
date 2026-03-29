# Server — patent-workbench

Express + TypeScript backend that validates, sanitizes, and proxies generation requests to a local Ollama instance.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com) running locally (default: `http://localhost:11434`)

## Getting started

```bash
cd server
npm install
npm run dev
```

## Scripts

| Script | Description |
| --- | --- |
| `dev` | Start dev server with ts-node-dev (watch mode) |
| `build` | Compile TypeScript to `dist/` |
| `start` | Run compiled server |
| `lint` | Run ESLint |

## Endpoints

### `GET /status`

Health check. Returns server status, LLM reachability, and round-trip latency to Ollama.

```json
{ "success": true, "data": { "server": "ok", "llm": "ok", "latency": 12 } }
```

### `POST /generate`

Forward a prompt to the local LLM and return the response.

Request body:

```json
{ "prompt": "string (required)", "model": "string (optional, default: mistral)" }
```

Success response:

```json
{ "success": true, "data": { "response": "string" } }
```

Example:

```bash
curl -X POST http://localhost:3001/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Write a patent abstract for a self-healing polymer.", "model": "mistral"}'
```

## Request pipeline

1. **Helmet** — sets security headers (CSP, HSTS, X-Frame-Options, etc.)
2. **CORS** — configurable allowed origin
3. **Compression** — gzip response bodies
4. **Rate limiting** — global limit + stricter per-IP limit on `/generate` (see env vars)
5. **Zod validation** — rejects malformed request bodies with HTTP 400
6. **Sanitize middleware** — trims whitespace, enforces max prompt length, detects and rejects prompt injection patterns (e.g. "ignore instructions", "act as", "jailbreak")
7. **LLM service** — calls Ollama `/api/generate` with a 2-minute timeout via `AbortController`
8. **Error handler** — centralized; never exposes stack traces to the client

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Server port |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `CORS_ORIGIN` | `http://localhost:3003` | Allowed CORS origin |
| `BODY_LIMIT` | `128kb` | Max JSON body size |
| `RATE_WINDOW_MS` | `900000` | Rate-limit window in ms (15 min) |
| `RATE_MAX` | `100` | Max requests per window (global) |
| `PROMPT_MAX_LENGTH` | `2000` | Max prompt length in characters |
| `LOG_LEVEL` | `info` | Pino log level |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Graceful shutdown timeout |

## TODOs

- Add unit and integration tests for routes and the LLM service layer (mock Ollama responses).
- Add CI to run linting and tests on pull requests.
- Expand prompt injection detection patterns.

## Maintainer

@jhonatan-saints
