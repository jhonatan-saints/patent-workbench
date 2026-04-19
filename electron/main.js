'use strict'

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('node:path')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
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
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(SERVER_PORT),
    HOST: SERVER_HOST,
    ELECTRON_MODE: 'true',
    CORS_ORIGIN: `http://${SERVER_HOST}:${SERVER_PORT}`,
    CLIENT_DIST_DIR: resourcePath('client'),
    DATA_DIR: dataDir,
  }

  serverProcess = spawn(process.execPath, [serverEntry], {
    env,
    stdio: 'ignore',
  })

  serverProcess.on('exit', (code) => {
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
  const iconCandidates = [
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'client', 'src', 'assets', 'icons', 'favicon-32x32.png'),
  ]
  let icon = nativeImage.createEmpty()
  for (const p of iconCandidates) {
    if (fs.existsSync(p)) { icon = nativeImage.createFromPath(p); break }
  }

  tray = new Tray(icon)
  tray.setToolTip('Patent Workbench')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Patent Workbench', click: () => { mainWindow?.show(); mainWindow?.focus() } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit() } },
    ])
  )
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// IPC

ipcMain.handle('get-version',        () => app.getVersion())
ipcMain.handle('window-minimize',    () => mainWindow?.minimize())
ipcMain.handle('window-maximize',    () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.handle('window-close',       () => { app.isQuitting = true; app.quit() })
ipcMain.handle('window-is-maximized',() => mainWindow?.isMaximized() ?? false)

// App events

app.on('ready', async () => {
  createWindow()
  createTray()

  if (IS_DEV) {
    // Dev: server and Vite are started externally by `npm run electron:dev`.
    const viteUrl = `http://${SERVER_HOST}:${VITE_DEV_PORT}/patent-workbench`
    const ok = mainWindow && await loadUrlWithRetry(mainWindow, viteUrl, READY_TIMEOUT_MS)
    if (!ok) { app.quit(); return }
  } else {
    // Production: own the server lifecycle, then load the React app from Express.
    startServer()
    const appUrl = `http://${SERVER_HOST}:${SERVER_PORT}/patent-workbench`
    const ok = mainWindow && await loadUrlWithRetry(mainWindow, appUrl, READY_TIMEOUT_MS)
    if (!ok) { app.quit(); return }
    applyFirstRunConfig()
  }

  if (!IS_DEV) autoUpdater.checkForUpdatesAndNotify()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.isQuitting = true; app.quit() }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (serverProcess) serverProcess.kill('SIGTERM')
})
