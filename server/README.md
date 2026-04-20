# Server — patent-workbench

Express + TypeScript backend that validates, sanitizes, and proxies generation requests to a local Ollama instance. The server is the sole gateway between the React client and the LLM — the browser never communicates with Ollama directly.

## Usage modes

| Mode | How the server starts | Config |
| --- | --- | --- |
| **Desktop app (Electron)** | Spawned automatically as a child process by `electron/main.js` on app launch | Port, host, CORS origin, and data directory are injected as environment variables by the main process — no `.env` file needed |
| **Web / dev mode** | Started manually with `npm run server:dev` (or `npm run start` from the repo root) | Copy `.env.example` to `.env` and adjust as needed |

## Requirements

- Node.js v24.14.0+
- [Ollama](https://ollama.com) running locally (default: `http://localhost:11434`)

## Recommended models

Pull any model with `ollama pull <model>` before use. The active model is selected in the client UI; `DEFAULT_MODEL` in `.env` is the fallback when none is specified.

| Model | Size | Speed | Quality | Notes |
| --- | --- | --- | --- | --- |
| `qwen2.5:7b` | ~4.7 GB | Medium | Very good | **Recommended** — best reasoning and structured text for patent generation |
| `mistral` | ~4 GB | Medium | Good | Good baseline; default in older setups |
| `phi3:mini` | ~2.3 GB | Fast | Good | Best option for low-end or older hardware |
| `phi4` | ~9 GB | Slow | Excellent | Highest quality; requires 16 GB+ RAM |

```bash
ollama pull qwen2.5:7b
```

## Getting started

```bash
cd server
npm install
cp .env.example .env   # adjust as needed
npm run dev
```

---

## Scripts

| Script | Description |
| --- | --- |
| `dev` | Start dev server with `ts-node-dev` in watch mode |
| `build` | Compile TypeScript to `dist/` |
| `start` | Run the compiled server (`dist/server.js`) |
| `lint` | Run ESLint |
| `format` | Format source files with Prettier |

---

## Endpoints

### `GET /status`

Health check. Returns server status, LLM reachability, and round-trip latency to Ollama.

```json
{ "success": true, "data": { "server": "ok", "llm": "ok", "latency": 12 } }
```

When Ollama is unreachable the `llm` field returns `"unavailable"` and the HTTP status is still `200` — the client UI reflects the error via the status indicator badge.

---

### `GET /models`

Returns the list of models currently available in the local Ollama instance.

```json
{ "success": true, "data": { "models": ["mistral", "llama3:8b", "phi3"] } }
```

---

### `GET /models/:name/context`

Returns the `num_ctx` value **explicitly set in the model's Modelfile parameters**. Returns `null` if `num_ctx` is not set in the Modelfile (i.e. only the Ollama global runtime setting exists, which is not exposed by `/api/show`).

```json
{ "success": true, "data": { "contextLength": 8192 } }
```

> **Note:** The architectural maximum (`model_info.*.context_length` from `/api/show`) is intentionally ignored. Only the Modelfile `num_ctx` parameter is trusted because the Ollama desktop app's global context override is invisible to the API and can silently differ.

---

### `POST /generate`

Forward a validated, sanitized prompt to the local LLM and return the response with token counts.

**Request body:**

```json
{ "prompt": "string (required)", "model": "string (optional, default: mistral)" }
```

**Success response:**

```json
{
  "success": true,
  "data": {
    "response": "OPTION 1:\n...\n\nOPTION 2:\n...\n\nOPTION 3:\n...",
    "promptTokens": 420,
    "completionTokens": 310
  }
}
```

**Error responses:**

| Status | Cause |
| --- | --- |
| `400` | Validation failed (missing/empty prompt, prompt too long) or injection pattern detected |
| `429` | Rate limit exceeded |
| `502` | Ollama returned an error or an unexpected response shape |

**Example:**

```bash
curl -X POST http://localhost:3001/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Write a patent abstract for a self-healing polymer.", "model": "mistral"}'
```

---

### `GET /settings`

Returns all persisted runtime settings as a JSON object (`defaultModel`, `llmTimeoutMs`, `numOptions`, `ollamaUrl`, `promptMaxLength`, `shutdownTimeoutMs`, `logLevel`, `apiKey`). The `apiKey` field is managed server-side via the `API_KEY` env var and is not exposed in the client settings UI.

### `PUT /settings`

Validates and persists a full settings object. Applies `logLevel` immediately (no restart needed). `apiKey` is stored in the DB and forwarded by the client as the `x-api-key` header on subsequent requests.

### `POST /settings/reset`

Restores all settings to factory defaults (hardcoded, not env-var-derived). The client's API key is cleared.

### `GET /template`

Returns the current workflow template JSON (steps, RAG config, workflow order) stored in `app_settings.reg_template`.

### `PUT /template`

Validates and persists a workflow template. All `workflow.order` entries must reference existing keys in `steps`. Field limits enforced: `systemContext` ≤ 8 000 chars, `promptSuffix` ≤ 512 chars, `guidedPromptSuffix` ≤ 1 024 chars.

### `POST /template/reset`

Restores the factory template from `server/src/config/defaultTemplate.ts`.

---

### Backup endpoints

#### `GET /backups/export`

Checkpoints the WAL file (`PRAGMA wal_checkpoint(FULL)`) then serves the raw SQLite database as a binary attachment (`workbench-backup-<date>.db`). Use this to download a portable snapshot of all drafts, settings, and the workflow template.

#### `POST /backups/import`

Accepts an `application/octet-stream` body (max `100mb`). Validates the SQLite magic bytes (`SQLite format 3`), writes the payload to a temporary file, closes the current DB connection, replaces the database file, and reopens it. The client reloads sessions, settings, and template after a successful import.

| Status | Cause |
| --- | --- |
| `400` | Body is missing, too short, or fails the SQLite magic-byte check |

---

### Sessions endpoints

Session data is persisted in a local SQLite database (`<DATA_DIR>/workbench.db`, default `./data/workbench.db`). Figures are stored in a normalised `figures` table (keyed by `session_id`); everything else is stored as JSON columns on the `sessions` table.

| Method | Route | Body / Params | Description |
| --- | --- | --- | --- |
| `GET` | `/sessions` | — | List all sessions newest-first (max 100); figures returned as **metadata only** (no `dataUrl`) for performance |
| `GET` | `/sessions/:id` | — | Fetch one full session including figure `dataUrl`s |
| `POST` | `/sessions` | `WorkflowSession` JSON | Upsert a session; figures are re-synced atomically in a transaction |
| `DELETE` | `/sessions/:id` | — | Delete one session (cascades to its figures) |
| `DELETE` | `/sessions` | — | Delete all sessions |

All `POST /sessions` bodies are validated with Zod. The `dataUrl` field on each figure is validated against an allowlist of safe MIME types (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/json`); `text/html` and `text/javascript` are explicitly rejected to prevent stored XSS.

---

## Request pipeline

Every `POST /generate` request passes through the following middleware stack in order:

```text
Helmet → CORS → Body Parser → Compression → Request ID
  → Global Rate Limit → /generate Rate Limit → Pino HTTP Logger
  → Zod Validation → Prompt Sanitization → LLM Service → Error Handler
```

### 1. Helmet

Sets security headers: `Content-Security-Policy`, `Strict-Transport-Security` (1 year), `X-Content-Type-Options: nosniff`, `Cross-Origin-Embedder-Policy`, and `Referrer-Policy: no-referrer`.

### 2. CORS

Configured via `CORS_ORIGIN` (default `http://localhost:5173`). Rejects requests from any other origin.

### 3. Body parser + Compression

Parses JSON bodies up to `BODY_LIMIT` (default `512kb`). The `/sessions` routes use a separate `50mb` limit to accommodate base64-encoded figure data URLs. Response bodies are gzip-compressed.

### 4. Request ID

Injects a UUID into `x-request-id` header if absent. Used for tracing across log lines.

### 5. Rate limiting

Two independent limiters:

| Limiter | Scope | Window | Max requests |
| --- | --- | --- | --- |
| Global | All routes | 15 min (`RATE_WINDOW_MS`) | 100 (`RATE_MAX`) |
| Generate | `POST /generate` only | 1 min (`GENERATE_RATE_WINDOW_MS`) | 20 (`GENERATE_RATE_MAX`) |

### 6. Pino HTTP logger

Logs method, URL, request ID, and response status. **Request bodies are never logged** — prompts may contain confidential invention disclosures.

### 7. Zod validation

Schema enforced on `POST /generate`:

```ts
z.object({
  prompt: z.string().min(1).max(PROMPT_MAX_LENGTH),  // default 64 000 chars
  model:  z.string().optional(),
})
```

Malformed bodies return HTTP `400` with a structured error.

### 8. Prompt sanitization

The `sanitizePrompt` middleware:

1. Trims leading/trailing whitespace.
2. Collapses runs of spaces/tabs to a single space (newlines are preserved so structured prompt formats stay intact).
3. Rejects with HTTP `400` if the prompt exceeds `PROMPT_MAX_LENGTH` characters (silent truncation is intentionally avoided — it can hide injections placed near the limit).
4. Normalises Unicode (NFKC) and lowercases before scanning for injection patterns; returns HTTP `400` if any match:

| Pattern | Regex |
| --- | --- |
| Ignore instructions | `/ignore (all\|previous\|above )?instructions/i` |
| Identity override | `/you are now/i` |
| Role substitution | `/act as (a\|an )?/i` |
| Jailbreak keyword | `/jailbreak/i` |
| Disregard instructions | `/disregard (all\|previous\|your )?/i` |
| Forget instructions | `/forget (all\|previous\|your )?instructions/i` |
| Persona swap | `/new persona/i` |
| Bypass safeguards | `/bypass (your\|all )?/i` |
| Override instructions | `/override (all\|your\|previous )?instructions/i` |
| Pretend to be | `/pretend (you are\|to be)/i` |
| Roleplay | `/roleplay as/i` |
| Instruction reset | `/from now on (you are\|ignore\|disregard\|forget)/i` |
| Instruction replacement | `/your (new\|updated )?instructions (are\|is)/i` |
| Stop being | `/stop being a/i` |
| System prompt | `/system prompt/i` |
| System tag | `/\[system\]/i` |
| DAN jailbreak | `/\bdan\b/i` |
| Developer mode | `/developer mode/i` |
| Unrestricted mode | `/unrestricted mode/i` |
| Without restrictions | `/without restrictions/i` |
| No restrictions | `/no restrictions/i` |

### 9. LLM service

Calls Ollama `POST /api/generate` with `stream: false`. Two abort signals are composed:

- **Timeout signal** — fires after `LLM_TIMEOUT_MS` (default 2 min) via `setTimeout + AbortController`.
- **Client disconnect signal** — the Express route listens for `req.on('close')` and aborts the Ollama fetch immediately when the HTTP client disconnects (e.g. user clicks Stop in the UI).

Token counts (`prompt_eval_count`, `eval_count`) are extracted from Ollama's response and forwarded to the client.

### 10. Error handler

Centralised last-resort middleware. Never exposes stack traces or internal details to the client. All unhandled errors return:

```json
{ "success": false, "error": "Internal server error" }
```

---

## Configuration

Copy `.env.example` to `.env`:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Node environment |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `DEFAULT_MODEL` | `qwen2.5:7b` | Fallback model when none is specified in the request. See [Recommended models](#recommended-models) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `BODY_LIMIT` | `512kb` | Max JSON body size for all routes except `/sessions` (which always uses `50mb`) |
| `DATA_DIR` | `./data` | Directory for the SQLite database (`workbench.db`); created automatically on first run |
| `RATE_WINDOW_MS` | `900000` | Global rate-limit window in ms (15 min) |
| `RATE_MAX` | `100` | Max requests per window (global) |
| `GENERATE_RATE_WINDOW_MS` | `60000` | Rate-limit window for `/generate` (1 min) |
| `GENERATE_RATE_MAX` | `20` | Max `/generate` requests per window |
| `PROMPT_MAX_LENGTH` | `16000` | Max prompt length in characters |
| `LLM_TIMEOUT_MS` | `120000` | Ollama request timeout in ms (2 min) |
| `LOG_LEVEL` | `info` | Pino log level |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Graceful shutdown timeout in ms |
| `API_KEY` | _(unset)_ | When set, all requests must supply a matching `x-api-key` header; requests without it receive HTTP `401` |
| `TRUST_PROXY` | _(unset)_ | Set to `true` when running behind a reverse proxy to trust `X-Forwarded-For` for rate limiting |

---

## Source structure

```
src/
├── app.ts                  # Express app: routes, middleware registration
├── server.ts               # Entry point; binds port, graceful shutdown
├── logger.ts               # Pino instance (shared across modules)
├── middleware/
│   ├── errorHandler.ts     # Last-resort error handler
│   ├── sanitize.ts         # Prompt trim, truncation, injection detection
│   └── validate.ts         # Zod body validation factory
├── config/
│   └── defaultTemplate.ts  # Factory workflow template (TypeScript constant — source of truth for POST /template/reset)
├── routes/
│   ├── sessions.ts         # Sessions CRUD routes + Zod schema + figure XSS validation
│   ├── settings.ts         # GET/PUT /settings + POST /settings/reset
│   ├── template.ts         # GET/PUT /template + POST /template/reset
│   └── backups.ts          # GET /backups/export (WAL checkpoint + file download) + POST /backups/import (SQLite replace)
└── services/
    ├── db.ts               # SQLite client (better-sqlite3); schema v8 + versioned migrations via PRAGMA user_version
    └── llm.service.ts      # Ollama HTTP integration (generate, checkLLM, listModels, getModelContextLength)
```

### DB schema (v8)

`app_settings` table columns: `default_model`, `llm_timeout_ms`, `num_options`, `ollama_url`, `prompt_max_length`, `shutdown_timeout_ms`, `log_level`, `reg_template` (JSON blob, v7), `api_key` (v8).

---

## TODOs

- Add unit and integration tests for routes and the LLM service layer (mock Ollama responses).
- Expand prompt injection detection patterns.

---

## Maintainer

@jhonatan-saints
