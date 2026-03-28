# Server — patent-workbench

Backend API for Patent Workbench.

Overview

This service accepts requests from the UI and forwards them to a local LLM runner (for example, Ollama). It provides a small REST API used by the client application.

Requirements

- Node.js 18+
- (Optional) A local LLM runner such as Ollama (default URL: [http://localhost:11434](http://localhost:11434))

Getting started

```bash
cd server
npm install
```

Run in development

```bash
npm run dev
```

Build and run (production)

```bash
npm run build
npm start
```

Useful scripts

- `dev` — start development server (ts-node-dev)
- `build` — compile TypeScript to `dist/`
- `start` — run compiled server
- `lint` — run ESLint against the source

How it works (high level)

- Middlewares: `helmet`, `cors`, `compression`, `express.json`.
- Logging with `pino` (configured in `src/logger.ts`).
- Global rate limiting and a stricter limit for `/generate`.
- Input validation using `zod` and a small sanitize middleware for `prompt`.
- Centralized error handling in `middleware/errorHandler.ts`.

Endpoints

- `GET /status`
  - Returns basic health information and whether the LLM runner is reachable.

  Example response:

  ```json
  {
    "success": true,
    "data": { "server": "ok", "llm": "ok", "latency": 12 }
  }
  ```

- `POST /generate`
  - Request body: `{ "prompt": string, "model": string (optional) }`
  - Success response: `{ "success": true, "data": { "response": string } }`

  Example:

  ```bash
  curl -X POST <http://localhost:3001/generate> \
    -H 'Content-Type: application/json' \
    -d '{"prompt":"Write a short summary about unit tests.","model":"mistral"}'
  ```

Configuration (env vars)

- `PORT` — server port (default: `3001`)
- `CORS_ORIGIN` — CORS allowed origin (default: `*`)
- `BODY_LIMIT` — JSON body size limit (default: `128kb`)
- `RATE_WINDOW_MS` — rate-limit window in ms (default: `900000`)
- `RATE_MAX` — max requests per `RATE_WINDOW_MS` (default: `100`)
- `PROMPT_MAX_LENGTH` — max prompt length (default: `2000`)
- `LOG_LEVEL` — pino log level (default: `info`)
- `SHUTDOWN_TIMEOUT_MS` — graceful shutdown timeout (default: `30000`)

Implementation notes

- `app.ts` composes routes and middleware; `server.ts` starts the server and handles graceful shutdown.
- `services/llm.service.ts` calls the local LLM HTTP API (`/api/generate`) using `fetch` with a 30s timeout.
- Validation uses Zod and returns HTTP 400 for invalid input.
- Sanitization trims and collapses whitespace, and truncates the prompt to `PROMPT_MAX_LENGTH`.

Suggestions and TODOs

- Make the LLM base URL configurable via an environment variable instead of hardcoding.
- Add unit and integration tests for the API and service layer (mock LLM responses).
- Add CI to run linting and tests on pull requests.

Contributing

- Open focused pull requests.
- Run `npm run lint` and `npm run format` before committing.

Maintainer

@jhonatan-saints
