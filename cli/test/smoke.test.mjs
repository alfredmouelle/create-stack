// Heavy proof: scaffold, install, run the project's own typecheck + biome. Skipped unless
// RUN_SMOKE=1; SMOKE_FRAMEWORK pins one base to split the matrix across runners.

import { spawnSync } from 'node:child_process'
import { afterAll, describe, expect, test } from 'vitest'
import { addCapability, build, cleanup, vendorComponent } from './helpers.mjs'

afterAll(cleanup)

const FRAMEWORKS = process.env.SMOKE_FRAMEWORK
  ? [process.env.SMOKE_FRAMEWORK]
  : ['tanstack', 'next']

// One rich and one stripped config per framework — the stripped one is where dangling
// seams would surface as a typecheck failure.
// 'full' also pins a custom import alias — proof the '~/' rewrite leaves a tree that
// still typechecks (bundler path resolution + every generated import).
const CONFIGS = [
  { name: 'full', capabilities: { storage: 's3', cache: 'redis' }, alias: '@' },
  { name: 'drizzle-only', foundations: [], mailer: 'none' },
  // Prisma exercises both seams (trpc context + better-auth adapter) on both frameworks;
  // the alias rewrite must also survive the generated-client import.
  { name: 'prisma-full', database: 'prisma', alias: '@' },
]

const TIMEOUT = 15 * 60 * 1000

const pnpm = (args, cwd, opts = {}) =>
  spawnSync('pnpm', ['--config.verify-deps-before-run=false', ...args], {
    cwd,
    stdio: 'inherit',
    ...opts,
  }).status

/** Install, re-format, then assert typecheck + biome are both green (mirrors the CLI). */
function verify(dir) {
  expect(spawnSync('pnpm', ['install'], { cwd: dir, stdio: 'inherit' }).status).toBe(0)
  pnpm(['run', 'check:write'], dir, { stdio: 'ignore' })
  expect(pnpm(['run', 'typecheck'], dir), 'typecheck').toBe(0)
  expect(pnpm(['run', 'check'], dir), 'biome check').toBe(0)
}

describe.skipIf(!process.env.RUN_SMOKE)('smoke', () => {
  for (const framework of FRAMEWORKS) {
    for (const cfg of CONFIGS) {
      test(
        `scaffold ${framework}/${cfg.name}`,
        () => verify(build({ ...cfg, framework }).dir),
        TIMEOUT,
      )
    }

    // Prisma without trpc/auth (one framework) — the db-only strip path must compile.
    if (framework === FRAMEWORKS[0]) {
      test(
        `scaffold ${framework}/prisma-only`,
        () =>
          verify(build({ framework, database: 'prisma', foundations: [], mailer: 'none' }).dir),
        TIMEOUT,
      )
    }

    // `add` path: adding, swapping an adapter, and vendoring a lib target must all compile.
    test(
      `add-swap ${framework}`,
      () => {
        const { dir } = build({
          framework,
          foundations: [],
          mailer: 'resend',
          capabilities: { cache: 'redis' },
          alias: '@', // each subsequent add must vendor against '@/', not '~/'
        })
        addCapability({ projectDir: dir, cap: 'cache', adapter: 'upstash' }) // swap adapter
        addCapability({ projectDir: dir, cap: 'mailer', adapter: 'brevo' }) // mailer swap
        addCapability({ projectDir: dir, cap: 'http', adapter: null }) // lib vendor
        verify(dir)
      },
      TIMEOUT,
    )

    // `component` path: opt-in UI (stripped by default) must compile once vendored back —
    // imports resolve, deps install, '~/' realigns to the project alias, hook included.
    test(
      `component ${framework}`,
      () => {
        const { dir } = build({
          framework,
          foundations: [],
          mailer: 'none',
          alias: '@', // vendored files must realign '~/' → '@/'
        })
        vendorComponent({ projectDir: dir, name: 'date-picker' })
        vendorComponent({ projectDir: dir, name: 'datatable' })
        verify(dir)
      },
      TIMEOUT,
    )
  }
})
