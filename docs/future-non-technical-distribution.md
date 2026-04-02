# Future: Non-Technical Distribution

This document captures planned approaches for making Patent Workbench accessible to users who are not comfortable with a terminal, Node.js, or developer tooling. The goal is to reduce the setup barrier to zero without requiring changes to the core application logic.

---

## Problem statement

The current setup requires a user to:

1. Install Node.js
2. Install Ollama and pull a model
3. Clone the repository or download a zip
4. Run `npm install` in a terminal
5. Run `npm start` or start frontend and backend separately
6. Open a browser and navigate to `localhost:5173`

This sequence is routine for a developer but prohibitive for a legal professional, IP analyst, or business stakeholder who is the primary end-user of the tool.

---

## Option 1 — Setup script (short term)

**Effort:** Low. No changes to application code.

A single script that automates the full installation sequence. The user downloads one file and runs it.

### Windows (`setup.ps1`)

```powershell
# Checks for Node.js and Ollama, installs via winget if missing,
# runs npm install, pulls a default model, and creates a desktop shortcut.
```

What the script would do:

- Detect Node.js via `node --version`; if missing, run `winget install OpenJS.NodeJS.LTS`
- Detect Ollama via `ollama --version`; if missing, run `winget install Ollama.Ollama`
- Run `npm install` in the project directory
- Run `ollama pull llama3` (or a configurable default)
- Create a `.bat` launcher on the Desktop that calls `npm start`

**User experience:** Download one `.ps1`, right-click → "Run with PowerShell", approve the UAC prompt, wait ~5 minutes, click the desktop shortcut.

**Limitations:** Requires an internet connection during setup. Still involves one manual step (running the script). Does not auto-update.

---

## Option 2 — Docker Compose (medium term)

**Effort:** Medium. Requires writing a `Dockerfile` and `docker-compose.yml`; no changes to application logic.

A single `docker-compose up` command starts the frontend, backend, and Ollama as containers. The user only needs Docker Desktop installed.

```yaml
# docker-compose.yml (sketch)
services:
  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
  server:
    build: ./server
    depends_on: [ollama]
  client:
    build: ./client
    ports:
      - "5173:5173"
    depends_on: [server]
```

**User experience:** Install Docker Desktop (graphical wizard), download the project folder, double-click a `start.bat` that runs `docker-compose up`. Open browser to `localhost:5173`.

**Limitations:** Docker Desktop is a significant download (~600 MB) and has its own learning curve. GPU passthrough for Ollama requires extra configuration on Windows. Not suitable for the least technical users.

---

## Option 3 — Electron desktop app (recommended long term)

**Effort:** High. Requires wrapping the existing stack in Electron and setting up a build pipeline.

Packages the entire application — Node.js runtime, Express server, and compiled React client — into a signed `.exe` installer for Windows and a `.dmg` for macOS. The user installs it like any commercial software.

### Architecture

```
Electron main process
  ├── Spawns Express server (server/src/app.ts compiled to JS)
  ├── Serves built React assets (client/dist/) via the embedded server
  └── Opens a BrowserWindow pointed at localhost
```

Ollama remains a separate install but can be handled gracefully:

- On first launch, detect Ollama via `ollama --version`
- If missing, show an in-app setup wizard that triggers a silent `winget install Ollama.Ollama`
- Prompt the user to choose a model from a curated list and pull it in the background with a progress bar

### Build tooling

- `electron-builder` — produces `.exe` (NSIS installer), `.dmg`, and `.AppImage`
- `electron-updater` — enables auto-update from a GitHub release or private S3 bucket
- Code signing — required for Windows SmartScreen and macOS Gatekeeper to not block the install

### User experience

1. Download `PatentWorkbench-Setup-1.0.0.exe` from a release page
2. Run the installer (Next → Next → Install)
3. Launch from the Start Menu or Desktop shortcut
4. On first run: guided wizard checks for Ollama and pulls a model
5. The app opens — no browser, no terminal, no configuration

**Limitations:** Higher build and maintenance complexity. Ollama still needs to be installed (but can be automated). Code signing certificates have an annual cost.

---

## Comparison

| | Setup script | Docker Compose | Electron |
| --- | --- | --- | --- |
| Development effort | Low | Medium | High |
| User steps to install | ~2 | ~3 | 1 |
| Requires terminal | Yes (once) | Yes (once) | No |
| Auto-update | No | No | Yes |
| Offline capable after setup | Yes | Yes | Yes |
| GPU support (Ollama) | Yes | Extra config | Yes |
| Suitable for non-technical users | Partial | Partial | Yes |

---

## Recommended path

1. **Now:** ship the setup script as a stop-gap. Covers the majority of cases with minimal investment.
2. **Next:** evaluate Electron once the feature set stabilises. The Express + Vite architecture maps cleanly onto the Electron main/renderer model and would require no changes to business logic.
3. **Skip Docker** as the primary distribution target for end-users; keep it available for self-hosted / IT-managed deployments where Docker Desktop is already present.
