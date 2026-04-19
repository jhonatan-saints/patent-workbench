'use strict'

const { FuseV1Options, FuseVersion } = require('@electron/fuses')

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.patentworkbench.app',
  productName: 'Patent Workbench',

  // electron-builder reads the main entry and version from the root package.json.
  directories: {
    buildResources: 'build',
    output: 'dist-electron',
  },

  // Only package the Electron main-process files. Server and client are
  // bundled as extraResources so they land outside the ASAR and remain
  // readable by Node (better-sqlite3 native module, etc.).
  files: ['electron/**/*'],

  extraResources: [
    { from: 'server/dist/bundle.js', to: 'server/server.js' },
    { from: 'client/dist', to: 'client', filter: ['**/*'] },
    { from: 'server/node_modules/better-sqlite3', to: 'server/node_modules/better-sqlite3', filter: ['**/*'] },
    { from: 'server/node_modules/bindings', to: 'server/node_modules/bindings', filter: ['**/*'] },
    { from: 'server/node_modules/file-uri-to-path', to: 'server/node_modules/file-uri-to-path', filter: ['**/*'] },
    { from: 'build/icon.png', to: 'icon.png' },
  ],

  win: {
    target: [{ target: 'dir', arch: ['x64'] }],
    icon: 'build/icon.png',
    executableName: 'patent_workbench',

    // Code-signing: set CSC_LINK and CSC_KEY_PASSWORD env vars in CI.
    // When neither is set, skip signing entirely so winCodeSign is not needed.
    sign: process.env.CSC_LINK ? undefined : null,
  },

  afterPack: async (context) => {
    const { flipFuses } = require('@electron/fuses')
    const { packager } = context
    const ext = packager.platform.nodeName === 'win32' ? '.exe' : ''
    const electronBinary = require('node:path').join(
      context.appOutDir,
      `${packager.appInfo.productFilename}${ext}`
    )
    await flipFuses(electronBinary, {
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: true,
    })
  },

  publish: {
    provider: 'github',
    owner: 'jhonatan-saints',
    repo: 'patent-workbench',
  }
}
