import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    root,
    environment: 'happy-dom',
    include: ['probe-a.spec.ts'],
    css: true
  }
})
