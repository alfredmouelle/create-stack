// Heavy proof: scaffold, install, run the project's own typecheck + biome. Skipped unless
// RUN_SMOKE=1; SMOKE_FRAMEWORK pins one base to split the matrix across runners.

import { spawnSync } from 'node:child_process'
import { afterAll, describe, expect, test } from 'vitest'
import { addCapability, build, cleanup } from './helpers.mjs'

afterAll(cleanup)

const FRAMEWORKS = process.env.SMOKE_FRAMEWORK
  ? [process.env.SMOKE_FRAMEWORK]
  : ['tanstack', 'next']

// One rich and one stripped config per framework — the stripped one is where dangling
// seams would surface as a typecheck failure.
const CONFIGS = [
  { name: 'full', capabilities: { storage: 's3', cache: 'redis' } },
  { name: 'drizzle-only', foundations: ['drizzle'], mailer: 'none' },
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

    // `add` path: adding, swapping an adapter, and vendoring a lib target must all compile.
    test(
      `add-swap ${framework}`,
      () => {
        const { dir } = build({
          framework,
          foundations: ['drizzle'],
          mailer: 'resend',
          capabilities: { cache: 'redis' },
        })
        addCapability({ projectDir: dir, cap: 'cache', adapter: 'upstash' }) // swap adapter
        addCapability({ projectDir: dir, cap: 'mailer', adapter: 'brevo' }) // mailer swap
        addCapability({ projectDir: dir, cap: 'http', adapter: null }) // lib vendor
        verify(dir)
      },
      TIMEOUT,
    )
  }
})
