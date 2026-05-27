import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [vue(), tailwindcss()],
  base: process.env.NODE_ENV === 'production' ? './' : '/',
  cacheDir: resolve(__dirname, 'node_modules/.vite-omnitestagent'),
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    target: 'esnext'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@features': resolve(__dirname, 'src/renderer/features'),
      '@components': resolve(__dirname, 'src/renderer/components'),
      '@composables': resolve(__dirname, 'src/renderer/composables'),
      '@store': resolve(__dirname, 'src/renderer/store'),
      '@utils': resolve(__dirname, 'src/renderer/utils'),
      '@types': resolve(__dirname, 'src/renderer/types')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173
  }
})
