'use strict'

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
    { from: 'server/dist', to: 'server', filter: ['**/*'] },
    { from: 'client/dist', to: 'client', filter: ['**/*'] },
    // node_modules needed by the server at runtime (better-sqlite3, express, …)
    { from: 'server/node_modules', to: 'server/node_modules', filter: ['**/*'] },
  ],

  win: {
    // Produce an unpacked directory that Inno Setup will wrap into the wizard
    // installer. Change to 'nsis' if you want a standalone self-contained setup.
    target: [{ target: 'dir', arch: ['x64'] }],
    icon: 'build/icon.png',

    // Code-signing: set CSC_LINK and CSC_KEY_PASSWORD env vars in CI.
    // When neither is set, skip signing entirely so winCodeSign is not needed.
    sign: process.env.CSC_LINK ? undefined : null,
  },

  publish: {
    provider: 'github',
    // Replace with the actual org/repo when publishing releases.
    owner: 'jhonatan-saints',
    repo: 'patent-workbench',
  }
}
