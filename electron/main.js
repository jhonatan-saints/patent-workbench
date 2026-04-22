'use strict'

// Crash logger registered BEFORE any other requires so module-load failures are captured.
// Uses os.homedir() — never depends on Electron app state.
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const _earlyLogPath = path.join(os.homedir(), 'AppData', 'Roaming', 'patent-workbench-crash.log')

function writeMainLog(msg) {
  try {
    // Prefer userData/logs once app is ready; fall back to the early log path.
    let logFile = _earlyLogPath
    try {
      const logDir = path.join(app.getPath('userData'), 'logs')
      fs.mkdirSync(logDir, { recursive: true })
      logFile = path.join(logDir, 'main.log')
    } catch { /* app not ready yet */ }
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`)
  } catch { /* ignore logging failures */ }
}

process.on('uncaughtException', (err) => {
  writeMainLog(`uncaughtException: ${err?.stack || err}`)
  try { app.quit() } catch { process.exit(1) }
})
process.on('unhandledRejection', (reason) => {
  writeMainLog(`unhandledRejection: ${reason?.stack || reason}`)
})

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, utilityProcess } = require('electron')
const { autoUpdater } = require('electron-updater')
const http = require('node:http')

// Constants
const SERVER_PORT = 3001
const SERVER_HOST = '127.0.0.1'
const VITE_DEV_PORT = 3003
const READY_TIMEOUT_MS = 60_000 // How long to keep polling before giving up.
const POLL_INTERVAL_MS = 400 // Poll interval between health-check attempts.

const IS_DEV = !app.isPackaged

// Path helpers

function resourcePath(...segments) {
  if (IS_DEV) return path.join(__dirname, '..', ...segments)
  return path.join(process.resourcesPath, ...segments)
}

function getDataDir() {
  return path.join(app.getPath('userData'), 'data')
}

function getLogsDir() {
  return path.join(app.getPath('userData'), 'logs')
}

function getBackupsDir() {
  return path.join(app.getPath('userData'), 'backups')
}

const MAX_BACKUPS = 5

async function backupDatabase() {
  try {
    const dbFile = path.join(getDataDir(), 'workbench.db')
    if (!fs.existsSync(dbFile)) return

    const backupsDir = getBackupsDir()
    await fs.promises.mkdir(backupsDir, { recursive: true })

    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-').slice(0, 19)
    const destBase = path.join(backupsDir, `workbench-${stamp}.db`)

    await fs.promises.copyFile(dbFile, destBase)
    for (const ext of ['-wal', '-shm']) {
      const src = `${dbFile}${ext}`
      if (fs.existsSync(src)) await fs.promises.copyFile(src, `${destBase}${ext}`)
    }

    const all = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith('workbench-') && f.endsWith('.db'))
      .sort((a, b) => a.localeCompare(b))
    for (const old of all.slice(0, Math.max(0, all.length - MAX_BACKUPS))) {
      for (const ext of ['', '-wal', '-shm']) {
        try { await fs.promises.unlink(path.join(backupsDir, old + ext)) } catch { /* already gone */ }
      }
    }

    writeMainLog(`backup created: ${destBase}`)
  } catch (err) {
    writeMainLog(`backup failed: ${err?.message}`)
  }
}

// State
let mainWindow = null
let serverProcess = null
let tray = null
app.isQuitting = false

// Server lifecycle

function startServer() {
  const serverEntry = resourcePath('server', 'server.js')
  const dataDir = getDataDir()
  const logsDir = getLogsDir()

  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(logsDir, { recursive: true })

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(SERVER_PORT),
    HOST: SERVER_HOST,
    ELECTRON_MODE: 'true',
    CORS_ORIGIN: `http://${SERVER_HOST}:${SERVER_PORT}`,
    CLIENT_DIST_DIR: resourcePath('client'),
    DATA_DIR: dataDir,
    LOGS_DIR: logsDir,
  }

  serverProcess = utilityProcess.fork(serverEntry, [], { env, stdio: 'pipe' })

  serverProcess.stdout?.on('data', (d) => writeMainLog(`[server stdout] ${d.toString().trim()}`))
  serverProcess.stderr?.on('data', (d) => writeMainLog(`[server stderr] ${d.toString().trim()}`))

  serverProcess.on('spawn', () => writeMainLog('server spawned'))
  serverProcess.on('exit', (code) => {
    writeMainLog(`server exited with code ${code}`)
    if (!app.isQuitting && code !== 0) app.quit()
  })
}

// Loads a URL into a BrowserWindow, retrying on failure until the deadline.
async function loadUrlWithRetry(win, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await win.loadURL(url)
      return true
    } catch {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
  }
  return false
}

// Reads config/settings.json written by the Inno Setup wizard, applies it via
// the settings API, then removes the file so it is only applied once.
function applyFirstRunConfig() {
  const configPath = path.join(app.getPath('userData'), 'config', 'settings.json')
  if (!fs.existsSync(configPath)) return

  let settings
  try { settings = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { return }

  const body = JSON.stringify(settings)
  const req = http.request(
    {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: '/settings',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    },
    (res) => res.resume()
  )
  req.on('error', () => {})
  req.end(body)

  try { fs.unlinkSync(configPath) } catch {}
}

// Window

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: IS_DEV,
    backgroundColor: '#0e0e0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (!IS_DEV) {
    mainWindow.webContents.on('devtools-opened', () => mainWindow.webContents.closeDevTools())
  }

  mainWindow.on('maximize',   () => mainWindow.webContents.send('window-maximize-change', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximize-change', false))

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide() }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const { protocol } = new URL(url)
      if (protocol === 'https:' || protocol === 'http:') shell.openExternal(url)
    } catch { /* invalid URL — drop silently */ }
    return { action: 'deny' }
  })
}

// Tray

function createTray() {
  const iconPath = resourcePath('icon.png')
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('Patent Workbench')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Patent Workbench', click: () => { mainWindow?.show(); mainWindow?.focus() } },
      { type: 'separator' },
      { label: 'Open Backup Folder', click: () => { shell.openPath(getBackupsDir()) } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } },
    ])
  )
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

if (!IS_DEV) Menu.setApplicationMenu(null)

// IPC

ipcMain.handle('get-version',        () => app.getVersion())
ipcMain.handle('window-minimize',    () => mainWindow?.minimize())
ipcMain.handle('window-maximize',    () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.handle('window-close',       () => { app.isQuitting = true; app.quit() })
ipcMain.handle('window-is-maximized',() => mainWindow?.isMaximized() ?? false)

// App events

app.on('ready', async () => {
  try {
    writeMainLog('app ready')
    createWindow()
    writeMainLog('window created')
    createTray()
    writeMainLog('tray created')

    if (IS_DEV) {
      const viteUrl = `http://${SERVER_HOST}:${VITE_DEV_PORT}/patent-workbench`
      const ok = mainWindow && await loadUrlWithRetry(mainWindow, viteUrl, READY_TIMEOUT_MS)
      if (!ok) { app.quit(); return }
    } else {
      startServer()
      writeMainLog('server process forked')
      const appUrl = `http://${SERVER_HOST}:${SERVER_PORT}/patent-workbench`
      const ok = mainWindow && await loadUrlWithRetry(mainWindow, appUrl, READY_TIMEOUT_MS)
      writeMainLog(`loadUrl result: ${ok}`)
      if (!ok) { app.quit(); return }
      applyFirstRunConfig()
    }

    if (!IS_DEV) autoUpdater.checkForUpdatesAndNotify()
  } catch (err) {
    writeMainLog(`ready handler error: ${err?.stack || err}`)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.isQuitting = true; app.quit() }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})

let _backupDone = false
app.on('before-quit', (event) => {
  if (_backupDone) return
  event.preventDefault()
  app.isQuitting = true
  if (serverProcess) serverProcess.kill()
  backupDatabase().finally(() => {
    _backupDone = true
    app.quit()
  })
})
