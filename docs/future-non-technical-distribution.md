# Non-Technical Distribution Plan

The goal is to make Patent Workbench installable and runnable by legal professionals, IP analysts, and business stakeholders with no terminal, no Node.js knowledge, and no manual configuration.

---

## Status

| Phase | Approach | Status |
| --- | --- | --- |
| Stop-gap | `setup.ps1` Windows script | Done — ships with v1.x |
| Target | Electron desktop app + Inno Setup installer | Planned — next major version |

---

## Phase 1 — Setup script (shipped)

`scripts/setup.ps1` automates the full installation sequence for Windows users who are comfortable running a PowerShell script.

**What it does:**

1. Detects Node.js v24.14.0+; installs via `winget` if missing or outdated
2. Detects Ollama; installs via `winget` if missing
3. Checks if the default model (`qwen2.5:7b`) is already pulled; pulls it if not
4. Runs `npm install` in the project root
5. Creates a `Patent Workbench.bat` launcher on the Desktop

**User steps:** Right-click the `.ps1` → Run with PowerShell → wait ~5 min → click Desktop shortcut.

**Limitations:** Requires a terminal once. No auto-update. No GUI wizard. Browser opens separately.

---

## Phase 2 — Electron desktop app (planned)

Packages the full stack into a signed `.exe` installer. The user installs it like any commercial software — no terminal, no Node.js, no manual steps.

### 2.1 Prerequisite changes before Electron work begins

Before building the Electron wrapper, the following application changes are required:

#### 2.1.1 Settings fully configurable from the client

All runtime configuration must be editable from the Settings panel in the UI. No `.env` file is exposed to the user.

| Setting | Current state | Target state |
| --- | --- | --- |
| Default model | DB + UI | Already done |
| Ollama URL | DB + UI | Already done |
| LLM timeout, num options, prompt max length | DB + UI | Already done |
| Log level, shutdown timeout | DB + UI | Already done |
| Theme (dark/light) | localStorage | Already done |
| UI language | localStorage | Already done |
| API key | Env var only | Add to Settings UI |

Env vars (`PORT`, `HOST`, `CORS_ORIGIN`, rate limits, etc.) are fixed at build time in the Electron context and not exposed to the user.

#### 2.1.2 Workflow template editable from the client

`client/src/config/reg-templates.json` is currently a static file baked into the React build. In the Electron app, users must be able to edit it without recompiling.

**Implementation plan:**

- Add `reg_template` (TEXT, JSON blob) to the `app_settings` table — seeded from the current JSON on first run (schema migration v7)
- Add `GET /template` and `PUT /template` API endpoints
- Client loads the template from the API at boot instead of a static import
- Add a "Template" section to the Settings panel with a **structured per-step editor**:
  - Editable fields per step: label, system prompt (`systemContext`), prompt suffix, guided fields
  - RAG parameters section (maxPriorSections, maxContextFileChars, etc.)
  - Step order drag-and-drop (or up/down arrows)
  - Reset to default button

---

### 2.2 Installer wizard

Built with **Inno Setup** — produces a signed `.exe` with a native Windows wizard UI.

**Wizard steps:**

| # | Step | What happens |
| --- | --- | --- |
| 1 | Welcome | Logo, version, brief description |
| 2 | Node.js | Detects v24.14.0+; installs via `winget` if missing — progress shown inline |
| 3 | Ollama | Detects Ollama; installs via `winget` if missing |
| 4 | LLM model | Lists models available locally; if none, lets the user pick from a curated list and pulls in the background with a progress bar |
| 5 | Configuration | Ollama URL (default `http://localhost:11434`), UI language, number of options per step (1-5) — all pre-fill from detected state |
| 6 | Install directory | Default: `C:\Users\<user>\Patent Workbench` |
| 7 | Installing | Runs `npm install`, builds client and server, writes `workbench.db` with seeded settings, creates Start Menu and Desktop shortcuts |
| 8 | Done | Launch button |

---

### 2.3 Directory structure after install

```
C:\Users\<user>\Patent Workbench\
├── PatentWorkbench.exe        <- Electron app entry point
├── app\
│   ├── main.js                <- Electron main process
│   ├── preload.js
│   ├── server\                <- compiled Express (server/dist/)
│   └── client\                <- compiled React (client/dist/)
├── data\
│   └── workbench.db           <- SQLite (sessions, settings, template)
├── logs\
│   └── app.log
└── config\
    └── settings.json          <- installer-time config (read once on first boot to seed DB)
```

---

### 2.4 Electron app architecture

```
Electron main process (main.js)
  |- Spawns Express server (app/server/server.js) as a child process
  |- Waits for server health check on localhost:3001
  |- Opens BrowserWindow pointed at localhost:3001/patent-workbench
  |- System tray icon with "Open" and "Quit" menu
  |- Splash screen shown during server startup
```

**Key behaviours:**

- Closing the window minimises to system tray (app keeps running)
- Right-click tray icon → Quit to fully exit
- Splash screen shown while Express is starting up
- Auto-update via `electron-updater` from GitHub Releases
- `DATA_DIR` env var passed to Express pointing to `data/` inside the install directory — keeps the database and logs out of `app/`

---

### 2.5 Build tooling

| Tool | Purpose |
| --- | --- |
| `electron` | App runtime |
| `electron-builder` | Produces `.exe` (NSIS), `.dmg`, `.AppImage` |
| `electron-updater` | Auto-update from GitHub Releases |
| Inno Setup | Prerequisite-checking installer wizard (wraps the electron-builder output) |
| Code signing certificate | Required for Windows SmartScreen and macOS Gatekeeper |

**Build pipeline (CI):**

1. `npm run build` — compiles client (Vite) and server (tsc)
2. `electron-builder` — packages into platform-specific bundles
3. Inno Setup compiler — wraps the bundle into the wizard installer
4. Upload to GitHub Releases — `electron-updater` picks it up for auto-update

---

### 2.6 What stays out of scope for this version

- macOS `.dmg` — Windows only for the first Electron release
- Docker Compose — kept available for IT-managed/self-hosted deployments, not for end-users
- Multi-user / server deployments — out of scope; this is a local single-user app
