const { spawn } = require('node:child_process')
const { resolve } = require('node:path')

const root = resolve(__dirname, '..')
const isWin32 = process.platform === 'win32'

console.log('Starting OmniTestAgent Desktop...')
console.log('  1. Building main/preload with tsc...')

try {
  const { execSync } = require('node:child_process')
  execSync('npx tsc -p tsconfig.main.json', { cwd: root, stdio: 'inherit' })
  execSync('npx tsc -p tsconfig.preload.json', { cwd: root, stdio: 'inherit' })
  console.log('  Main/Preload build: OK')
} catch (e) {
  console.error('  Main/Preload build FAILED, continuing anyway...')
}

console.log('  2. Starting Vite dev server for renderer...')

const vite = spawn('npx', ['vite', 'dev'], {
  cwd: root,
  shell: true,
  stdio: ['pipe', 'pipe', 'inherit']
})

let viteOutput = ''
vite.stdout.on('data', (data) => {
  const text = data.toString()
  process.stdout.write(text)
  viteOutput += text
})

let electronStarted = false

function startElectron(rendererUrl) {
  if (electronStarted) return
  electronStarted = true
  console.log('  3. Starting Electron main process...')

  const electronArgs = isWin32
    ? ['electron', '.']
    : ['electron', '--no-sandbox', '.']

  const electronEnv = { ...process.env }
  delete electronEnv.ELECTRON_RUN_AS_NODE
  electronEnv.ELECTRON_RENDERER_URL = rendererUrl

  const electron = spawn('npx', electronArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: electronEnv,
  })

  electron.on('close', (code) => {
    vite.kill()
    process.exit(code || 0)
  })
}

const urlCheckInterval = setInterval(() => {
  const cleaned = viteOutput.replace(/\x1b\[[0-9;]*m/g, '')
  const match = cleaned.match(/127\.0\.0\.1:(\d+)/)
  if (match) {
    clearInterval(urlCheckInterval)
    startElectron(`http://127.0.0.1:${match[1]}/`)
  }
}, 500)

setTimeout(() => {
  clearInterval(urlCheckInterval)
  if (!electronStarted) {
    console.log('  Warning: Could not detect Vite URL, using default...')
    startElectron('http://localhost:5173')
  }
}, 15000)

vite.on('close', () => process.exit(0))
