// Heavy proof: scaffold, install deps, and run the generated project's own typecheck
// + biome — the real guarantee that a fork actually builds. Skipped unless RUN_SMOKE=1
// (CI sets it); SMOKE_FRAMEWORK can pin a single base to split the matrix across runners.

import { spawnSync } from 'node:child_process'
import { afterAll, describe, expect, test } from 'vitest'
import { build, cleanup } from './helpers.mjs'

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

describe.skipIf(!process.env.RUN_SMOKE)('smoke', () => {
  for (const framework of FRAMEWORKS) {
    for (const cfg of CONFIGS) {
      test(
        `${framework}/${cfg.name}`,
        () => {
          const { dir } = build({ ...cfg, framework })

          expect(spawnSync('pnpm', ['install'], { cwd: dir, stdio: 'inherit' }).status).toBe(0)
          // vendored capabilities rewrite imports; let biome normalize before linting.
          if (Object.keys(cfg.capabilities ?? {}).length) {
            pnpm(['run', 'check:write'], dir, { stdio: 'ignore' })
          }
          expect(pnpm(['run', 'typecheck'], dir), 'typecheck').toBe(0)
          expect(pnpm(['run', 'check'], dir), 'biome check').toBe(0)
        },
        TIMEOUT,
      )
    }
  }
})
