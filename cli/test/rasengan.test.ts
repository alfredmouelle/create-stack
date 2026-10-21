import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.ts'

afterAll(cleanupAcceptanceFixtures)

test('the executable CLI creates a Rasengan project and enriches the detected application', () => {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-rasengan-'))
  const entry = fileURLToPath(new URL('../index.mjs', import.meta.url))
  const project = join(root, 'storefront')
  try {
    const created = spawnSync(
      process.execPath,
      [
        entry,
        'storefront',
        '--framework',
        'rasengan',
        '--pm',
        'pnpm',
        '--no-install',
        '--no-git',
        '--alias',
        '@storefront',
        '--errors',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    expect(created.status, created.stdout + created.stderr).toBe(0)
    expect(created.stdout).toContain('RasenganJS (preview)')
    expect(existsSync(join(project, 'scripts/start.ts'))).toBe(true)
    expect(readFileSync(join(project, '.env.example'), 'utf8')).toContain('RASENGAN_SENTRY_DSN=')
    expect(readFileSync(join(project, 'src/features/auth/sign-in-form.tsx'), 'utf8')).toContain(
      '@storefront/components/ui/button',
    )
    const added = spawnSync(process.execPath, [entry, 'add', 'cache', 'memory', '--no-install'], {
      cwd: project,
      encoding: 'utf8',
    })
    expect(added.status, added.stdout + added.stderr).toBe(0)
    expect(existsSync(join(project, 'src/server/cache/adapters/memory.ts'))).toBe(true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test.each([
  ['storage', ['s3', 'r2', 'gcs', 'local'], 'src/server/storage/index.ts'],
  ['cache', ['redis', 'upstash', 'memory'], 'src/server/cache/index.ts'],
  ['logger', ['pino', 'console'], 'src/server/logger/index.ts'],
  ['analytics', ['posthog', 'plausible', 'noop'], 'src/server/analytics/index.ts'],
  ['mailer', ['resend', 'brevo', 'ses'], 'src/server/email/index.ts'],
] as const)(
  'adds and changes every %s provider in a detected Rasengan app',
  (capability, providers, entry) => {
    const fixture = createAcceptanceFixture('standalone')
    const created = runCli({
      cwd: fixture.root,
      target: fixture.app,
      args: ['project', '--framework', 'rasengan', '--minimal', '--no-install', '--no-git'],
    })
    expect(created.exitStatus, created.stdout + created.stderr).toBe(0)
    const userFile = join(fixture.app, 'src/lib/order-reference.ts')
    const userSource = "export const orderReference = 'ORD-2048'\n"
    writeFileSync(userFile, userSource)
    for (const provider of providers) {
      const result = runCli({
        cwd: fixture.app,
        target: fixture.app,
        args: ['add', capability, provider, '--no-install'],
      })
      expect(result.exitStatus, result.stdout + result.stderr).toBe(0)
      expect(readFileSync(join(fixture.app, entry), 'utf8')).toContain(provider)
      expect(readFileSync(userFile, 'utf8')).toBe(userSource)
    }
  },
)

test('validates a Rasengan addition batch before mutation, then adds framework integrations together', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(
    runCli({
      cwd: fixture.root,
      target: fixture.app,
      args: ['project', '--framework', 'rasengan', '--minimal', '--no-install', '--no-git'],
    }).exitStatus,
  ).toBe(0)
  const invalid = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', '--with', 'storage=r2', '--with', 'jobs=trigger', '--no-install'],
  })
  expect(invalid.exitStatus).toBe(1)
  expect(invalid.targetMutated).toBe(false)
  const added = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: [
      'add',
      '--with',
      'jobs',
      '--with',
      'errors',
      '--with',
      'email-ui',
      '--with',
      'http',
      '--no-install',
    ],
  })
  expect(added.exitStatus, added.stdout + added.stderr).toBe(0)
  for (const path of [
    'src/app/_api/inngest.route.ts',
    'src/instrument.client.ts',
    'instrument.server.mjs',
    'sentry.vite.ts',
    'src/emails/components/index.ts',
    'src/lib/http/index.ts',
  ])
    expect(existsSync(join(fixture.app, path)), path).toBe(true)
  expect(readFileSync(join(fixture.app, 'src/index.ts'), 'utf8')).toContain(
    "import './instrument.client'",
  )
  expect(readFileSync(join(fixture.app, '.env.example'), 'utf8')).toContain('RASENGAN_SENTRY_DSN=')
  expect(readFileSync(join(fixture.app, 'rasengan.config.js'), 'utf8')).toContain(
    '...sentryPlugins()',
  )
})
