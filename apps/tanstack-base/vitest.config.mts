import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { defineConfig } from 'vitest/config'

const env = Object.assign(
  {},
  ...['.env.test', '.env.test.local']
    .filter((file) => existsSync(file))
    .map((file) => parse(readFileSync(file))),
)

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    dir: 'src',
    env,
    globalSetup: './src/test/global-setup.ts',
    setupFiles: './src/test/setup.ts',
    fileParallelism: false,
    passWithNoTests: true,
  },
})
