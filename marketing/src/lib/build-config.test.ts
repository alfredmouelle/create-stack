import { describe, expect, it } from 'vitest'
import {
  type BuildState,
  buildCommand,
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
      minimal: false,
    })
    expect(result.conflicts).toEqual([])
    expect(result.command).toBe('pnpm dlx @alfredmouelle/create-stack@latest my-app')
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
      '?v=1&name=my+shared+app&pm=bun&framework=next&database=prisma&auth=clerk&trpc=0&mailer=ses&alias=%23&mono=turbo&cap=storage%3Dgcs&cap=analytics%3Dplausible',
    )
    expect(parsed).toEqual({ kind: 'current', state })
  })

  it('reports unsupported URL schema versions without changing their meaning', () => {
    expect(parseBuildState('?v=9&name=legacy')).toEqual({
      kind: 'unsupported',
      version: '9',
    })
  })

  it('quotes project names that need shell protection', () => {
    expect(buildCommand({ ...defaultBuildState(), projectName: "Ada's app" })).toBe(
      "pnpm dlx @alfredmouelle/create-stack@latest 'Ada'\\''s app'",
    )
  })
})
