import { PM_VERSIONS } from './package-manager.mjs'
import { join, write } from './util.mjs'

const setupNode = (nvmrc, cache) => `      - uses: actions/setup-node@v4
        with:
          node-version-file: ${nvmrc}${cache ? `\n          cache: ${cache}` : ''}`

const SETUP = {
  pnpm: (nvmrc) => `      - uses: pnpm/action-setup@v4
        with:
          version: ${PM_VERSIONS.pnpm}
${setupNode(nvmrc, 'pnpm')}
      - run: pnpm install --frozen-lockfile`,
  npm: (nvmrc) => `${setupNode(nvmrc, 'npm')}
      - run: npm ci`,
  yarn: (nvmrc) => `${setupNode(nvmrc, 'yarn')}
      - run: yarn install --frozen-lockfile`,
  bun: (nvmrc) => `${setupNode(nvmrc)}
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile`,
}

export function writeCiWorkflow(projectDir, pm, nvmrc = '.nvmrc') {
  const setup = (SETUP[pm.name] ?? SETUP.npm)(nvmrc)
  const yaml = `name: CI

on:
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
      - run: ${pm.name} run test
`
  write(join(projectDir, '.github/workflows/ci.yml'), yaml)
}
