import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    dir: 'src',
    passWithNoTests: true,
  },
})
