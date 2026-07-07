// Generated projects ship a GitHub Actions workflow mirroring the scaffold's own
// quality gate — install + typecheck + biome — driven by the chosen package manager.
// (Tests are hook-driven and optional: not every scaffold ships a test script/files.)

import { join, write } from './util.mjs'

const NODE_VERSION = 22

// Per-PM setup + install steps (YAML, indented to sit in a job's `steps:` list).
const SETUP = {
  pnpm: `      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${NODE_VERSION}
          cache: pnpm
      - run: pnpm install --frozen-lockfile`,
  npm: `      - uses: actions/setup-node@v4
        with:
          node-version: ${NODE_VERSION}
          cache: npm
      - run: npm ci`,
  yarn: `      - uses: actions/setup-node@v4
        with:
          node-version: ${NODE_VERSION}
          cache: yarn
      - run: yarn install --frozen-lockfile`,
  bun: `      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile`,
}

/** Write .github/workflows/ci.yml wired to the chosen package manager. */
export function writeCiWorkflow(projectDir, pm) {
  const setup = SETUP[pm.name] ?? SETUP.npm
  const yaml = `name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${setup}
      - run: ${pm.name} run typecheck
      - run: ${pm.name} run check
`
  write(join(projectDir, '.github/workflows/ci.yml'), yaml)
}
