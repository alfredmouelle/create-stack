import { describe, expect, test } from 'vitest'
import { resolveStackConfiguration, stackConfigurationCliArgs } from '../src/index.js'

describe('resolveStackConfiguration', () => {
  test('resolves the recommended stack', () => {
    const result = resolveStackConfiguration()

    expect(result.configuration).toEqual({
      framework: 'tanstack',
      database: 'drizzle',
      auth: 'better-auth',
      trpc: true,
      mailer: 'resend',
      minimal: false,
    })
    expect(result.conflicts).toEqual([])
    expect(result.reasons).toEqual([
      { axis: 'framework', kind: 'recommended', message: 'recommended stack', value: 'tanstack' },
      { axis: 'database', kind: 'recommended', message: 'recommended stack', value: 'drizzle' },
      {
        axis: 'auth',
        kind: 'recommended',
        message: 'recommended stack',
        value: 'better-auth',
      },
      { axis: 'trpc', kind: 'recommended', message: 'recommended stack', value: true },
      { axis: 'mailer', kind: 'recommended', message: 'recommended stack', value: 'resend' },
    ])
  })

  test('applies recommendations around an explicit database choice', () => {
    const result = resolveStackConfiguration({ database: 'convex' })

    expect(result.configuration).toEqual({
      framework: 'tanstack',
      database: 'convex',
      auth: 'clerk',
      trpc: false,
      mailer: 'none',
      minimal: false,
    })
    expect(result.reasons).toEqual([
      {
        axis: 'framework',
        kind: 'recommended',
        message: 'applicable recommendation',
        value: 'tanstack',
      },
      { axis: 'database', kind: 'explicit', message: 'requested', value: 'convex' },
      { axis: 'auth', kind: 'recommended', message: 'applicable recommendation', value: 'clerk' },
      { axis: 'trpc', kind: 'recommended', message: 'applicable recommendation', value: false },
      { axis: 'mailer', kind: 'recommended', message: 'applicable recommendation', value: 'none' },
    ])
  })

  test('completes Better Auth dependencies without overriding explicit exclusions', () => {
    const result = resolveStackConfiguration({ auth: 'better-auth' })

    expect(result.configuration).toEqual({
      framework: 'tanstack',
      database: 'drizzle',
      auth: 'better-auth',
      trpc: true,
      mailer: 'resend',
      minimal: false,
    })
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

    const excluded = resolveStackConfiguration({ auth: 'better-auth', database: 'none' })
    expect(excluded.conflicts).toEqual([
      {
        axes: ['auth', 'database'],
        message: 'Better Auth requires a database; remove --no-db or choose another auth',
      },
    ])
    expect(excluded.cliArgs).toEqual([])
  })

  test('completes Better Auth dependencies from a minimal starting point', () => {
    const result = resolveStackConfiguration({ minimal: true, auth: 'better-auth' })

    expect(result.configuration).toEqual({
      framework: 'tanstack',
      database: 'drizzle',
      auth: 'better-auth',
      trpc: false,
      mailer: 'resend',
      minimal: true,
    })
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

  test('uses explicit exclusions for a minimal project', () => {
    const result = resolveStackConfiguration({ minimal: true })

    expect(result.configuration).toEqual({
      framework: 'tanstack',
      database: 'none',
      auth: 'none',
      trpc: false,
      mailer: 'none',
      minimal: true,
    })
    expect(result.reasons).toEqual([
      {
        axis: 'framework',
        kind: 'recommended',
        message: 'applicable recommendation',
        value: 'tanstack',
      },
      { axis: 'database', kind: 'minimal', message: 'minimal exclusion', value: 'none' },
      { axis: 'auth', kind: 'minimal', message: 'minimal exclusion', value: 'none' },
      { axis: 'trpc', kind: 'minimal', message: 'minimal exclusion', value: false },
      { axis: 'mailer', kind: 'minimal', message: 'minimal exclusion', value: 'none' },
    ])
    expect(result.cliArgs).toEqual(['--minimal'])
  })

  test('preserves explicit exclusions outside minimal mode', () => {
    const result = resolveStackConfiguration({
      database: 'none',
      auth: 'none',
      trpc: false,
      mailer: 'none',
    })

    expect(result.configuration).toMatchObject({
      database: 'none',
      auth: 'none',
      trpc: false,
      mailer: 'none',
    })
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        { axis: 'database', kind: 'explicit', message: 'requested exclusion', value: 'none' },
        { axis: 'auth', kind: 'explicit', message: 'requested exclusion', value: 'none' },
        { axis: 'trpc', kind: 'explicit', message: 'requested exclusion', value: false },
        { axis: 'mailer', kind: 'explicit', message: 'requested exclusion', value: 'none' },
      ]),
    )
  })

  test('reports every explicit choice conflict without applying precedence', () => {
    const result = resolveStackConfiguration({
      database: 'convex',
      auth: 'better-auth',
      trpc: true,
      mailer: 'none',
    })

    expect(result.conflicts).toEqual([
      { axes: ['database', 'auth'], message: 'Better Auth cannot be used with Convex' },
      { axes: ['database', 'trpc'], message: 'Convex cannot be combined with tRPC' },
      {
        axes: ['auth', 'mailer'],
        message: 'Better Auth requires mail; remove --no-mail or choose another auth',
      },
    ])
    expect(result.configuration).toMatchObject({
      database: 'convex',
      auth: 'better-auth',
      trpc: true,
      mailer: 'none',
    })
    expect(result.cliArgs).toEqual([])
  })

  test('orders explicit CLI arguments independently of input property order', () => {
    const result = resolveStackConfiguration({
      mailer: 'ses',
      trpc: false,
      auth: 'clerk',
      database: 'prisma',
      minimal: true,
      framework: 'next',
    })

    expect(result.cliArgs).toEqual([
      '--framework',
      'next',
      '--minimal',
      '--database',
      'prisma',
      '--auth',
      'clerk',
      '--no-trpc',
      '--mailer',
      'ses',
    ])
    expect(stackConfigurationCliArgs({ database: 'prisma', auth: 'clerk' })).toEqual([
      '--database',
      'prisma',
      '--auth',
      'clerk',
    ])
    expect(() => stackConfigurationCliArgs({ database: 'convex', trpc: true })).toThrow(
      'Convex cannot be combined with tRPC',
    )
  })
})
