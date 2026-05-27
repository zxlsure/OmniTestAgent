# OmniTestAgent - One Key Start
$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

function Step($msg) {
    $ts = Get-Date -Format 'HH:mm:ss'
    Write-Host "[$ts] $msg" -ForegroundColor Green
}

function Err($msg) {
    $ts = Get-Date -Format 'HH:mm:ss'
    Write-Host "[$ts] ERROR: $msg" -ForegroundColor Red
}

Write-Host ''
Write-Host '============================================' -ForegroundColor Cyan
Write-Host '   OmniTestAgent - One Key Start' -ForegroundColor Cyan
Write-Host '============================================' -ForegroundColor Cyan
Write-Host ''

# Check Node.js
Step 'Checking Node.js...'
$hasNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $hasNode) {
    Err 'Node.js not found, please install Node.js 20.x LTS'
    exit 1
}
$nodeVer = node --version
Step "Node.js: $nodeVer"

# Check npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Err 'npm not found'
    exit 1
}

# Install dependencies
if (-not (Test-Path 'node_modules')) {
    Step 'Installing dependencies...'
    npm install 2>&1 | Out-Null
    if (-not (Test-Path 'node_modules')) {
        Err 'Install failed. Please run: npm install'
        exit 1
    }
    Step 'Dependencies installed'
} else {
    Step 'node_modules exists, skip install'
}

# Start dev
Step 'Starting OmniTestAgent...'
Write-Host ''
Write-Host '============================================' -ForegroundColor Yellow
Write-Host '   Starting... Press Ctrl+C to stop' -ForegroundColor Yellow
Write-Host '============================================' -ForegroundColor Yellow
Write-Host ''

node scripts/dev.js
