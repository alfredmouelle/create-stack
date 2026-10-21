import { FRAMEWORK_SUPPORT, type FrameworkSupport } from '@alfredmouelle/stack-config'
import { describe, expect, it } from 'vitest'
import {
  type BuildState,
  buildCommand,
  creationPlanLines,
  defaultBuildState,
  parseBuildState,
  resolveBuildState,
  serializeBuildState,
} from './build-config'

describe('build configurator state', () => {
  it('starts from the shared recommended stack and a deterministic command', () => {
    const result = resolveBuildState(defaultBuildState())

    expect(result.configuration).toEqual({
      framework: 'tanstack',
      database: 'drizzle',
      auth: 'better-auth',
      trpc: true,
      mailer: 'resend',
      formatter: 'biome',
      linter: 'biome',
      minimal: false,
    })
    expect(result.conflicts).toEqual([])
    expect(result.command).toBe('pnpm dlx @alfredmouelle/create-stack@latest my-app')
  })

  it.each([
    { formatter: 'biome', linter: 'biome' },
    { formatter: 'biome', linter: 'oxlint' },
    { formatter: 'prettier', linter: 'biome' },
    { formatter: 'prettier', linter: 'oxlint' },
  ] as const)('preserves $formatter formatting and $linter linting in the command', (tools) => {
    const result = resolveBuildState({
      ...defaultBuildState(),
      ...tools,
    })

    expect(result.configuration).toMatchObject(tools)
    expect(result.conflicts).toEqual([])
    expect(result.command).toBe(
      `pnpm dlx @alfredmouelle/create-stack@latest my-app --formatter ${tools.formatter} --linter ${tools.linter}`,
    )
  })

  it('renders an explicit valid configuration, monorepo, and capabilities', () => {
    const state: BuildState = {
      ...defaultBuildState(),
      projectName: 'orbit',
      packageManager: 'npm',
      framework: 'next',
      database: 'convex',
      auth: 'clerk',
      trpc: false,
      mailer: 'none',
      monorepo: 'nx',
      capabilities: {
        storage: 'r2',
        jobs: 'inngest',
      },
    }

    const result = resolveBuildState(state)

    expect(result.conflicts).toEqual([])
    expect(result.command).toBe(
      'npx @alfredmouelle/create-stack@latest orbit --framework next --database convex --auth clerk --no-trpc --mailer none --monorepo nx --storage r2 --jobs inngest',
    )
  })

  it('shows dependency completion reasons from the shared resolver', () => {
    const result = resolveBuildState({ ...defaultBuildState(), auth: 'better-auth' })

    expect(result.reasons).toEqual(
      expect.arrayContaining([
        {
          axis: 'database',
          kind: 'dependency',
          message: 'dependency completion for Better Auth',
          value: 'drizzle',
        },
        {
          axis: 'mailer',
          kind: 'dependency',
          message: 'dependency completion for Better Auth',
          value: 'resend',
        },
      ]),
    )
  })

  it('does not produce a command for explicit conflicts', () => {
    const result = resolveBuildState({
      ...defaultBuildState(),
      database: 'convex',
      auth: 'better-auth',
      trpc: true,
      mailer: 'none',
    })

    expect(result.command).toBeNull()
    expect(result.conflicts.map(({ message }) => message)).toEqual([
      'Better Auth cannot be used with Convex',
      'Convex cannot be combined with tRPC',
      'Better Auth requires mail; remove --no-mail or choose another auth',
    ])
  })

  it('blocks choices unsupported by the selected framework', () => {
    const restrictedNext = {
      ...FRAMEWORK_SUPPORT.next,
      supports: {
        database: ['prisma', 'none'],
        auth: ['clerk', 'none'],
        trpc: [false],
        mailer: ['brevo', 'none'],
        formatter: ['prettier'],
        linter: ['oxlint'],
      },
      recommendations: {
        database: ['prisma'],
        auth: ['clerk'],
        trpc: false,
        mailer: ['brevo'],
        formatter: 'prettier',
        linter: 'oxlint',
      },
    } satisfies FrameworkSupport
    const result = resolveBuildState(
      {
        ...defaultBuildState(),
        framework: 'next',
        database: 'drizzle',
        auth: 'better-auth',
        trpc: true,
        mailer: 'ses',
        formatter: 'biome',
        linter: 'biome',
      },
      { ...FRAMEWORK_SUPPORT, next: restrictedNext },
    )

    expect(result.command).toBeNull()
    expect(result.conflicts.map(({ axes }) => axes)).toEqual([
      ['framework', 'database'],
      ['framework', 'auth'],
      ['framework', 'trpc'],
      ['framework', 'mailer'],
      ['framework', 'formatter'],
      ['framework', 'linter'],
    ])
  })

  it('round-trips shareable state in a stable query schema', () => {
    const state: BuildState = {
      ...defaultBuildState(),
      projectName: 'my shared app',
      packageManager: 'bun',
      framework: 'next',
      database: 'prisma',
      auth: 'clerk',
      trpc: false,
      mailer: 'ses',
      formatter: 'prettier',
      linter: 'oxlint',
      alias: '#',
      monorepo: 'turbo',
      capabilities: {
        analytics: 'plausible',
        storage: 'gcs',
      },
    }

    const encoded = serializeBuildState(state)
    const parsed = parseBuildState(encoded)

    expect(encoded).toBe(
      '?v=1&name=my+shared+app&pm=bun&framework=next&database=prisma&auth=clerk&trpc=0&mailer=ses&formatter=prettier&linter=oxlint&alias=%23&mono=turbo&cap=storage%3Dgcs&cap=analytics%3Dplausible',
    )
    expect(parsed).toEqual({ kind: 'current', state })
  })

  it('reports unsupported URL schema versions without changing their meaning', () => {
    expect(parseBuildState('?v=9&name=legacy')).toEqual({
      kind: 'unsupported',
      version: '9',
    })
  })

  it.each([
    ['formatter', 'oxfmt'],
    ['formatter', 'none'],
    ['linter', 'eslint'],
    ['linter', 'none'],
  ])('rejects an unavailable %s value from a shared URL: %s', (axis, value) => {
    expect(parseBuildState(`?v=1&${axis}=${value}`)).toEqual({
      kind: 'invalid',
      message: `Invalid ${axis} value "${value}"`,
    })
  })

  it('keeps existing shared URLs on the recommended quality tools without adding flags', () => {
    const parsed = parseBuildState('?v=1&name=orbit&pm=pnpm&framework=next')

    expect(parsed.kind).toBe('current')
    if (parsed.kind !== 'current') throw new Error('Expected a current configuration')
    expect(serializeBuildState(parsed.state)).toBe('?v=1&name=orbit&pm=pnpm&framework=next')
    expect(resolveBuildState(parsed.state)).toMatchObject({
      configuration: { formatter: 'biome', linter: 'biome' },
      command: 'pnpm dlx @alfredmouelle/create-stack@latest orbit --framework next',
    })
  })

  it('does not produce a command for an invalid import alias', () => {
    expect(buildCommand({ ...defaultBuildState(), alias: 'app.lib' })).toBeNull()
  })

  it('renders the creation plan in the CLI format', () => {
    const state = defaultBuildState()

    expect(creationPlanLines(state, resolveBuildState(state))).toEqual([
      'Target: my-app',
      'Framework: TanStack Start',
      'Monorepo: (none)',
      'Package manager: pnpm',
      'Import alias: ~/',
      'Database: drizzle, recommended stack',
      'Auth: better-auth, recommended stack',
      'tRPC: yes, recommended stack',
      'Mailer: resend, recommended stack',
      'Formatter: biome, recommended stack',
      'Linter: biome, recommended stack',
      'Capabilities: (none)',
      'Install and verify: yes',
      'Initialize Git: yes (outside an existing repository)',
    ])
  })

  it('marks explicit choices and capabilities as requested in the creation plan', () => {
    const state: BuildState = {
      ...defaultBuildState(),
      projectName: 'orbit',
      framework: 'next',
      database: 'prisma',
      monorepo: 'turbo',
      capabilities: { storage: 'r2' },
    }
    const lines = creationPlanLines(state, resolveBuildState(state))

    expect(lines).toContain('Framework: Next.js')
    expect(lines).toContain('Monorepo: Turborepo')
    expect(lines).toContain('Database: prisma, requested')
    expect(lines).toContain('Capabilities: storage (r2), requested')
  })

  it('quotes project names that need shell protection', () => {
    expect(buildCommand({ ...defaultBuildState(), projectName: "Ada's app" })).toBe(
      "pnpm dlx @alfredmouelle/create-stack@latest 'Ada'\\''s app'",
    )
  })
})
