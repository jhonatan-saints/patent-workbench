# Non-Technical Distribution Plan

The goal is to make Patent Workbench installable and runnable by legal professionals, IP analysts, and business stakeholders with no terminal, no Node.js knowledge, and no manual configuration.

---

## Status

| Phase | Approach | Status |
| --- | --- | --- |
| Stop-gap | `setup.ps1` Windows script | Done — ships with v1.x |
| Target | Electron desktop app + Inno Setup installer | In progress — Electron app done; installer pending |

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

## Phase 2 — Electron desktop app (in progress)

Packages the full stack into a signed `.exe` installer. The user installs it like any commercial software — no terminal, no Node.js, no manual steps.

### 2.1 Prerequisite changes — status

#### 2.1.1 Settings fully configurable from the client — Done

All runtime configuration is editable from the Settings panel (General tab). No `.env` file is exposed to the user.

| Setting | Status |
| --- | --- |
| Default model | Done |
| Ollama URL | Done |
| LLM timeout, num options, prompt max length | Done |
| Log level, shutdown timeout | Done |
| Theme (dark/light) | Done — localStorage |
| UI language | Done — localStorage |
| API key (`x-api-key` header) | Done — PasswordInput in General tab; stored in SQLite `api_key` column (DB v8) |

Env vars (`PORT`, `HOST`, `CORS_ORIGIN`, rate limits) are fixed at build time in the Electron context and not exposed to the user.

#### 2.1.2 Workflow template editable from the client — Done (partial)

`reg-templates.json` is no longer baked into the React build at runtime. The template is stored in SQLite (`app_settings.reg_template`, seeded on first run) and served via API. The client loads it at boot and reinitialises all workflow modules in-place without a page reload.

**Done:**

- `app_settings.reg_template` column (DB migration v7); `api_key` column (DB migration v8)
- `GET /template`, `PUT /template`, `POST /template/reset` endpoints with Zod validation
- `POST /settings/reset` endpoint (restores factory defaults)
- Client loads template from API on boot via `loadTemplate()` in `App.tsx`
- `reinitFromTemplate()` mutates `WORKFLOW_MODULES` / `WORKFLOW_ORDER` / RAG config in-place — prompt generation picks up the new template on the next `Generate` call without a page reload
- Settings modal has three tabs:
  - **General** — all app settings + API Key field + Reset to Defaults
  - **Template** — per-step accordion editor (system context, prompt suffix, guided prompt suffix); Save disabled until changes are made
  - **RAG** — context limit fields (maxPriorSections, maxSectionChars, maxIdeaChars, maxConstraintsChars, maxContextFileChars)
- All labels use i18n resources; 16 new resources added and generated across all locales

**Still pending:**

- Step order reordering (drag-and-drop or up/down arrows) — deferred to next iteration
- Guided fields editor (add/remove/reorder per-step guided form fields) — deferred

---

### 2.2 Electron app — Done

The Electron shell is fully implemented and runnable in development and production modes.

#### Dev workflow

```bash
npm run electron:dev   # concurrently: server (ts-node-dev) + Vite + Electron
npm run electron:build # server build + client build (VITE_API_BASE=127.0.0.1:3001) + electron-builder
```

Vite dev server binds to `127.0.0.1:3003` (explicit host to avoid IPv6/IPv4 mismatch on Windows). The `ELECTRON_DEV=true` env var suppresses Vite's `server.open` so only the Electron window opens.

#### Main process (`electron/main.js`)

```
Electron main process
  |- Creates BrowserWindow (hidden, show:false) with contextIsolation + sandbox
  |- IS_DEV: retries loadURL(viteUrl) until Vite is ready, then shows window
  |- PROD:   spawns Express child process, retries loadURL until server is ready
  |- System tray: "Open Patent Workbench" / "Quit"
  |- IPC: get-version, window-minimize, window-maximize, window-close, window-is-maximized
  |- Fires window-maximize-change event to renderer on maximize/unmaximize
  |- applyFirstRunConfig(): reads config/settings.json written by installer, PUTs to /settings, deletes file
  |- Auto-update via electron-updater (production only)
```

`loadUrlWithRetry` polls `loadURL()` directly — if Electron rejects (ERR_CONNECTION_REFUSED) it retries every 400 ms up to 60 s, then quits. No intermediate `loading.html` is used; the window stays hidden until the React app renders.

#### Preload (`electron/preload.js`)

Exposed on `window.electronAPI` via contextBridge (sandbox-safe):

| Property / method | Purpose |
| --- | --- |
| `isElectron: true` | Feature-flag for Electron-only UI |
| `getVersion()` | Returns app version from `app.getVersion()` |
| `openExternal(url)` | Opens URLs in system browser |
| `windowMinimize()` | Minimises window to taskbar |
| `windowMaximize()` | Toggles maximise / restore |
| `windowClose()` | Quits the app |
| `windowIsMaximized()` | Returns current maximise state |
| `onMaximizeChange(cb)` | Subscribes to maximise/restore events; returns unsubscribe fn |

#### Boot sequence (UX) — actual implementation

| Step | What the user sees | Notes |
| --- | --- | --- |
| 1 | **Brand splash** (`BrandSplash.tsx`) — 3×3 grid builds cell by cell (360 ms interval), spins 90° (1 400 ms), then the stage slides left and "Patent" / "Workbench" fade in | Rendered inside the React app; triggers immediately on first paint |
| 2 | **App shell** (`App.tsx`) | Shown directly after `onDone` fires — no AppLoader in the Electron path |

The AppLoader screen is intentionally skipped in the Electron path: `BrandSplash.onDone` transitions the phase directly to `'ready'`. The brand splash itself is long enough (~7 s total) to cover server startup time on typical hardware.

#### Window controls (`WindowControls.tsx`)

Rendered in the app header to the right of `StatusIndicator`, only when `IS_ELECTRON`:

| Button | Icon | Behaviour |
| --- | --- | --- |
| Minimise | `IconMinus` (bottom-aligned) | Minimises window to taskbar |
| Maximise / Restore | `IconSquare` / `IconCopy` (dynamic) | Toggles based on `isMaximized` state |
| Close | `IconX` | If session drafts exist → shows confirm modal; otherwise quits immediately |

---

### 2.3 Installer wizard — Pending

Built with **Inno Setup** — produces a signed `.exe` with a native Windows wizard UI.
Script scaffolded at `installer/patent-workbench.iss`.

**Wizard steps:**

| # | Step | What happens |
| --- | --- | --- |
| 1 | Welcome | Logo, version, brief description |
| 2 | Node.js | Detects v24.14.0+; installs via `winget` if missing — progress shown inline |
| 3 | Ollama | Detects Ollama; installs via `winget` if missing |
| 4 | LLM model | Lists models available locally; if none, lets the user pick from a curated list and pulls in the background with a progress bar |
| 5 | Configuration | Ollama URL (default `http://localhost:11434`), UI language, number of options per step (1–5) — all pre-fill from detected state |
| 6 | Install directory | Default: `C:\Users\<user>\Patent Workbench` |
| 7 | Installing | Runs `npm install`, builds client and server, writes `workbench.db` with seeded settings, creates Start Menu and Desktop shortcuts |
| 8 | Done | Launch button |

---

### 2.4 Directory structure after install

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
- Guided fields editor (add/remove fields per step) — deferred post-Electron
- Step order drag-and-drop in template editor — deferred post-Electron
