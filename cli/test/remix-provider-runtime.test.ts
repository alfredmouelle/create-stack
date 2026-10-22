import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { afterAll, describe, expect, test } from 'vitest'

const cli = resolve(import.meta.dirname, '../index.mjs')
const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function verifyProviderRuntime(
  fixture: string,
  options: readonly string[],
  environment: Readonly<Record<string, string>> = {},
): void {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-remix-provider-'))
  roots.push(root)
  const created = spawnSync(
    process.execPath,
    [cli, 'customer-portal', '--framework', 'remix', '--pm', 'pnpm', '--no-git', ...options],
    { cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
  )
  expect(created.status, created.stdout + created.stderr).toBe(0)
  const project = join(root, 'customer-portal')
  copyFileSync(join(import.meta.dirname, 'fixtures/remix', fixture), join(project, 'runtime.mjs'))
  const runtime = spawnSync(
    process.execPath,
    [
      '--env-file=.env',
      '--import',
      './scripts/aliases.ts',
      '--import',
      'remix/node-tsx',
      'runtime.mjs',
    ],
    {
      cwd: project,
      encoding: 'utf8',
      env: { ...process.env, CLERK_TELEMETRY_DISABLED: '1', ...environment },
      timeout: 120_000,
    },
  )
  expect(runtime.status, runtime.stdout + runtime.stderr).toBe(0)
}

describe.skipIf(process.env.RUN_SMOKE !== '1')('native Remix provider runtime', () => {
  test.each([
    {
      name: 'Clerk signed request identities',
      fixture: 'clerk-runtime.txt',
      options: ['--database', 'convex', '--auth', 'clerk', '--mailer', 'none', '--no-trpc'],
      environment: { EXPECT_CONVEX_TOKEN: '1' },
    },
    {
      name: 'Clerk without a database',
      fixture: 'clerk-runtime.txt',
      options: ['--database', 'none', '--auth', 'clerk', '--mailer', 'none', '--no-trpc'],
      environment: { EXPECT_CONVEX_TOKEN: '0' },
    },
    {
      name: 'Sentry envelopes and signed Inngest invocation',
      fixture: 'sdk-runtime.txt',
      options: ['--minimal', '--jobs', '--error-tracking'],
      environment: {},
    },
  ])(
    '$name',
    ({ fixture, options, environment }) => verifyProviderRuntime(fixture, options, environment),
    300_000,
  )
  const override = resolve(import.meta.dirname, '../../apps/remix-base/.env.test.local')
  const databaseUrl = existsSync(override)
    ? parseEnv(readFileSync(override, 'utf8')).DATABASE_URL
    : process.env.REMIX_TEST_DATABASE_URL
  test.skipIf(databaseUrl === undefined)(
    'preserves HTTPS proxy origins without accepting cross-origin forms',
    () => {
      if (databaseUrl === undefined)
        throw new Error('An isolated Remix test database URL is required')
      verifyProviderRuntime(
        'proxy-runtime.txt',
        ['--database', 'drizzle', '--auth', 'better-auth', '--mailer', 'resend', '--no-trpc'],
        { DATABASE_URL: databaseUrl },
      )
    },
    300_000,
  )
})
