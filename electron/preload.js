'use strict'

const { contextBridge, ipcRenderer, shell } = require('electron')

function safeOpenExternal(url) {
  try {
    const { protocol } = new URL(url)
    if (protocol === 'https:' || protocol === 'http:') shell.openExternal(url)
  } catch { /* invalid URL — drop silently */ }
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getVersion:       () => ipcRenderer.invoke('get-version'),
  openExternal:     (url) => safeOpenExternal(url),
  windowMinimize:   () => ipcRenderer.invoke('window-minimize'),
  windowMaximize:   () => ipcRenderer.invoke('window-maximize'),
  windowClose:      () => ipcRenderer.invoke('window-close'),
  windowIsMaximized:() => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (cb) => {
    const handler = (_, isMax) => cb(isMax)
    ipcRenderer.on('window-maximize-change', handler)
    return () => ipcRenderer.removeListener('window-maximize-change', handler)
  },
})
