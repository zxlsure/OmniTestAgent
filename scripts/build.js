const { execSync } = require('node:child_process')
const { resolve } = require('node:path')

const root = resolve(__dirname, '..')

console.log('Building OmniTestAgent...')

console.log('  Building main process...')
execSync('npx tsc -p tsconfig.main.json', { cwd: root, stdio: 'inherit' })

console.log('  Building preload script...')
execSync('npx tsc -p tsconfig.preload.json', { cwd: root, stdio: 'inherit' })

console.log('  Building renderer (Vue 3 + Vite)...')
execSync('npx vite build', { cwd: root, stdio: 'inherit' })

console.log('Build complete.')
