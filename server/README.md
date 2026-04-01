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

Copy `.env.example` to `.env` and adjust as needed before starting.

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

### `GET /models`

Returns the list of models currently available in the local Ollama instance.

```json
{ "success": true, "data": { "models": ["mistral", "llama3:8b"] } }
```

### `GET /models/:name/context`

Returns the `num_ctx` value explicitly set in the model's Modelfile parameters. Returns `null` if `num_ctx` is not set (i.e., the Ollama app global setting is used).

```json
{ "success": true, "data": { "contextLength": 4096 } }
```

### `POST /generate`

Forward a prompt to the local LLM and return the response with token counts.

Request body:

```json
{ "prompt": "string (required)", "model": "string (optional, default: mistral)" }
```

Success response:

```json
{
  "success": true,
  "data": {
    "response": "string",
    "promptTokens": 120,
    "completionTokens": 340
  }
}
```

Example:

```bash
curl -X POST http://localhost:3001/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Write a patent abstract for a self-healing polymer.", "model": "mistral"}'
```

## Request pipeline

1. **Helmet** — sets security headers (CSP, HSTS, X-Frame-Options, etc.)
2. **CORS** — configurable allowed origin (`CORS_ORIGIN`)
3. **Compression** — gzip response bodies
4. **Request ID** — UUID injected into request headers for tracing
5. **Rate limiting** — global limit across all routes + a tighter, separate limit on `POST /generate` (see `GENERATE_RATE_WINDOW_MS` / `GENERATE_RATE_MAX`)
6. **Zod validation** — rejects malformed request bodies with HTTP 400
7. **Sanitize middleware** — trims whitespace, enforces max prompt length, detects and rejects prompt injection patterns (e.g. "ignore instructions", "act as", "jailbreak")
8. **LLM service** — calls Ollama `/api/generate` with a configurable timeout via `AbortController` (default 2 min, controlled by `LLM_TIMEOUT_MS`)
9. **Error handler** — centralised; never exposes stack traces to the client

## Configuration

Copy `.env.example` to `.env`:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Node environment |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `DEFAULT_MODEL` | `mistral` | Fallback model when none is specified in the request |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `BODY_LIMIT` | `512kb` | Max JSON body size |
| `RATE_WINDOW_MS` | `900000` | Rate-limit window in ms (15 min, global) |
| `RATE_MAX` | `100` | Max requests per window (global) |
| `GENERATE_RATE_WINDOW_MS` | `60000` | Rate-limit window in ms for `/generate` (1 min) |
| `GENERATE_RATE_MAX` | `20` | Max requests per window for `/generate` |
| `PROMPT_MAX_LENGTH` | `64000` | Max prompt length in characters |
| `LLM_TIMEOUT_MS` | `120000` | Ollama request timeout in ms |
| `LOG_LEVEL` | `info` | Pino log level |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Graceful shutdown timeout in ms |

## TODOs

- Add unit and integration tests for routes and the LLM service layer (mock Ollama responses).
- Add CI to run linting and tests on pull requests.
- Expand prompt injection detection patterns.

## Maintainer

@jhonatan-saints
