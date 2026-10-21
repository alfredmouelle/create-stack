import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { dir: 'test', maxWorkers: process.env.CI ? 2 : 4 },
})
