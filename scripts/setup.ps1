#Requires -Version 5.1
<#
.SYNOPSIS
    Patent Workbench - Windows setup script.
.DESCRIPTION
    Installs Node.js and Ollama (via winget) if missing, runs npm install,
    pulls a default LLM model, and creates a desktop launcher.
    Run once as a normal user; UAC prompts are triggered only when needed.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$REQUIRED_NODE_MAJOR = 24
$REQUIRED_NODE_MINOR = 14
$REQUIRED_NODE_PATCH = 0
$DEFAULT_MODEL       = 'qwen2.5:7b'
$PROJECT_DIR         = Split-Path -Parent $PSScriptRoot
$LAUNCHER_NAME       = 'Patent Workbench.bat'

function Write-Step([string]$msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Write-Ok([string]$msg) {
    Write-Host "    OK  $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "    WARN  $msg" -ForegroundColor Yellow
}

function Write-Fail([string]$msg) {
    Write-Host "`n    ERROR  $msg" -ForegroundColor Red
}

function Test-CommandExists([string]$cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Install-ViaWinget([string]$packageId, [string]$displayName) {
    if (-not (Test-CommandExists 'winget')) {
        Write-Fail "winget is not available. Install $displayName manually from the web, then re-run this script."
        exit 1
    }
    Write-Host "    Installing $displayName via winget - this may take a few minutes..." -ForegroundColor Yellow
    winget install --id $packageId --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

function Test-NodeVersion([string]$ver) {
    $parts = $ver -split '\.'
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2]
    if ($major -ne $REQUIRED_NODE_MAJOR) { return $major -gt $REQUIRED_NODE_MAJOR }
    if ($minor -ne $REQUIRED_NODE_MINOR) { return $minor -gt $REQUIRED_NODE_MINOR }
    return $patch -ge $REQUIRED_NODE_PATCH
}

# --- Step 1: Node.js ---

Write-Step 'Checking Node.js...'

if (Test-CommandExists 'node') {
    $nodeVer = (node -v) -replace '^v', ''
    if (Test-NodeVersion $nodeVer) {
        Write-Ok "Node.js $nodeVer"
    } else {
        Write-Warn "Node.js $nodeVer found, but v$REQUIRED_NODE_MAJOR.$REQUIRED_NODE_MINOR.$REQUIRED_NODE_PATCH or newer is required."
        Install-ViaWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS'
        $nodeVer = (node -v) -replace '^v', ''
        Write-Ok "Node.js $nodeVer installed"
    }
} else {
    Write-Host '    Node.js not found - installing...' -ForegroundColor Yellow
    Install-ViaWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS'
    if (-not (Test-CommandExists 'node')) {
        Write-Fail 'Node.js installed but node is still not in PATH. Restart this terminal and re-run the script.'
        exit 1
    }
    $nodeVer = (node -v) -replace '^v', ''
    Write-Ok "Node.js $nodeVer installed"
}

# --- Step 2: Ollama ---

Write-Step 'Checking Ollama...'

if (Test-CommandExists 'ollama') {
    $ollamaVer = ollama --version 2>&1
    Write-Ok "Ollama $ollamaVer"
} else {
    Write-Host '    Ollama not found - installing...' -ForegroundColor Yellow
    Install-ViaWinget 'Ollama.Ollama' 'Ollama'
    if (-not (Test-CommandExists 'ollama')) {
        Write-Fail 'Ollama installed but ollama is still not in PATH. Restart this terminal and re-run the script.'
        exit 1
    }
    Write-Ok 'Ollama installed'
}

# --- Step 3: npm install ---

Write-Step 'Installing npm dependencies...'

Set-Location $PROJECT_DIR
npm install

Write-Ok 'Dependencies installed'

# --- Step 4: Pull default model ---

Write-Step "Pulling default model ($DEFAULT_MODEL)..."
Write-Host '    This downloads several gigabytes on the first run. Subsequent runs are instant.' -ForegroundColor Yellow

$existingModels = ollama list 2>&1
if ($existingModels -match [regex]::Escape($DEFAULT_MODEL)) {
    Write-Ok "$DEFAULT_MODEL already present - skipping download"
} else {
    ollama pull $DEFAULT_MODEL
    Write-Ok "$DEFAULT_MODEL pulled"
}

# --- Step 5: Desktop launcher ---

Write-Step 'Creating desktop launcher...'

$desktopPath  = [System.Environment]::GetFolderPath('Desktop')
$launcherPath = Join-Path $desktopPath $LAUNCHER_NAME

$batLines = @(
    '@echo off',
    "cd /d `"$PROJECT_DIR`"",
    'start "Patent Workbench" cmd /k "npm start"'
)
$batContent = $batLines -join "`r`n"

Set-Content -Path $launcherPath -Value $batContent -Encoding ASCII
Write-Ok "Launcher created at: $launcherPath"

# --- Done ---

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  Setup complete!' -ForegroundColor Green
Write-Host ''
Write-Host '  To start Patent Workbench:' -ForegroundColor White
Write-Host "  - Double-click '$LAUNCHER_NAME' on your Desktop" -ForegroundColor White
Write-Host '  - Or run npm start in this directory' -ForegroundColor White
Write-Host ''
Write-Host '  The app will open at http://localhost:3003' -ForegroundColor White
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''
