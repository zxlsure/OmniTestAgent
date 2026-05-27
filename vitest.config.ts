import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@components': resolve(__dirname, 'src/renderer/components'),
      '@composables': resolve(__dirname, 'src/renderer/composables'),
      '@store': resolve(__dirname, 'src/renderer/store'),
      '@utils': resolve(__dirname, 'src/renderer/utils'),
      '@types': resolve(__dirname, 'src/renderer/types'),
    }
  },
  server: {
    deps: {
      external: [/^sql\.js/, /^echarts/, /^@arco-design/, /^happy-dom/, /^electron-store/, /^electron-updater/],
      inline: [/src\/main/],
    },
  },
})
