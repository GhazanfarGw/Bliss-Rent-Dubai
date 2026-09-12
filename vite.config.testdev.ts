import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Testing-only override: point the Vite dep cache at a fresh tmp dir so the
// dev server/test runner doesn't need to unlink files in the mounted
// project folder (this device's mount blocks delete on existing files).
// Mirrors vite.config.ts exactly otherwise. Safe to delete later.
export default defineConfig({
  cacheDir: path.join(os.tmpdir(), 'vite-cache-bliss-testdev'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    deps: {
      optimizer: {
        web: { enabled: false },
        ssr: { enabled: false },
      },
    },
    server: {
      deps: {
        inline: true,
      },
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
})
