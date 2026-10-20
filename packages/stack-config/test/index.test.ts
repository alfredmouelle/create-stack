import { describe, expect, test } from 'vitest'
import {
  FRAMEWORK_SUPPORT,
  type FrameworkSupport,
  resolveStackConfiguration,
  stackConfigurationCliArgs,
} from '../src/index.js'

const restrictedNext = {
  label: 'Next.js',
  maturity: 'preview',
  supports: {
    database: ['prisma', 'none'],
    auth: ['better-auth', 'clerk', 'none'],
    trpc: [false],
    mailer: ['brevo', 'none'],
    formatter: ['prettier'],
    linter: ['oxlint'],
  },
  recommendations: {
    database: ['prisma'],
    auth: ['better-auth', 'clerk'],
    trpc: false,
    mailer: ['brevo'],
    formatter: 'prettier',
    linter: 'oxlint',
  },
} satisfies FrameworkSupport

const frameworkSupport = { ...FRAMEWORK_SUPPORT, next: restrictedNext }

describe('resolveStackConfiguration', () => {
  test.each([
    { formatter: 'biome', linter: 'biome' },
    { formatter: 'biome', linter: 'oxlint' },
    { formatter: 'prettier', linter: 'biome' },
    { formatter: 'prettier', linter: 'oxlint' },
  ] as const)('preserves explicit $formatter formatting and $linter linting', (input) => {
    const result = resolveStackConfiguration(input)

    expect(result.configuration).toMatchObject(input)
    expect(result.conflicts).toEqual([])
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        { axis: 'formatter', kind: 'explicit', message: 'requested', value: input.formatter },
        { axis: 'linter', kind: 'explicit', message: 'requested', value: input.linter },
      ]),
    )
    expect(result.cliArgs).toEqual(['--formatter', input.formatter, '--linter', input.linter])
  })

  test('recommends Biome formatting and linting, including for a minimal project', () => {
    for (const input of [{}, { minimal: true }]) {
      const result = resolveStackConfiguration(input)

      expect(result.configuration).toMatchObject({ formatter: 'biome', linter: 'biome' })
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          {
            axis: 'formatter',
            kind: 'recommended',
            message: input.minimal ? 'applicable recommendation' : 'recommended stack',
            value: 'biome',
          },
          {
            axis: 'linter',
            kind: 'recommended',
            message: input.minimal ? 'applicable recommendation' : 'recommended stack',
            value: 'biome',
          },
        ]),
      )
    }
  })

  test.each([
    [{ formatter: 'oxfmt' }, 'oxfmt is not supported until its 1.0 release'],
    [{ linter: 'eslint' }, 'ESLint is not supported until typescript-eslint supports TypeScript 7'],
    [{ formatter: 'none' }, 'Invalid formatter'],
    [{ linter: 'none' }, 'Invalid linter'],
    [{ formatter: false }, 'Invalid formatter'],
    [{ linter: false }, 'Invalid linter'],
    [{ formatter: 'biome,prettier' }, 'Invalid formatter'],
    [{ linter: 'biome,oxlint' }, 'Invalid linter'],
  ])('rejects unsupported or excluded quality tools %j', (input, diagnostic) => {
    expect(() => Reflect.apply(resolveStackConfiguration, undefined, [input])).toThrow(diagnostic)
  })

  test('resolves the recommended stack', () => {
    const result = resolveStackConfiguration()

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
      { axis: 'formatter', kind: 'recommended', message: 'recommended stack', value: 'biome' },
      { axis: 'linter', kind: 'recommended', message: 'recommended stack', value: 'biome' },
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
      formatter: 'biome',
      linter: 'biome',
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
      {
        axis: 'formatter',
        kind: 'recommended',
        message: 'applicable recommendation',
        value: 'biome',
      },
      { axis: 'linter', kind: 'recommended', message: 'applicable recommendation', value: 'biome' },
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
      formatter: 'biome',
      linter: 'biome',
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
      formatter: 'biome',
      linter: 'biome',
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
      formatter: 'biome',
      linter: 'biome',
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
      {
        axis: 'formatter',
        kind: 'recommended',
        message: 'applicable recommendation',
        value: 'biome',
      },
      { axis: 'linter', kind: 'recommended', message: 'applicable recommendation', value: 'biome' },
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

  test('resolves omitted choices independently of conflicts between other choices', () => {
    const result = resolveStackConfiguration({
      database: 'convex',
      auth: 'better-auth',
      trpc: true,
    })

    expect(result.configuration.mailer).toBe('resend')
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

  test('reports an explicit choice the selected framework does not support', () => {
    const result = resolveStackConfiguration(
      { framework: 'next', database: 'drizzle', auth: 'clerk', trpc: true },
      frameworkSupport,
    )

    expect(result.conflicts).toEqual([
      {
        axes: ['framework', 'database'],
        message: 'Next.js does not support database "drizzle"; choose prisma or none',
      },
      {
        axes: ['framework', 'trpc'],
        message: 'Next.js does not support tRPC; use --no-trpc',
      },
    ])
    expect(result.cliArgs).toEqual([])
  })

  test('reports quality tools outside framework support as choice conflicts', () => {
    const result = resolveStackConfiguration(
      { framework: 'next', formatter: 'biome', linter: 'biome' },
      frameworkSupport,
    )

    expect(result.conflicts).toEqual([
      {
        axes: ['framework', 'formatter'],
        message: 'Next.js does not support formatter "biome"; choose prettier',
      },
      {
        axes: ['framework', 'linter'],
        message: 'Next.js does not support linter "biome"; choose oxlint',
      },
    ])
    expect(result.configuration).toMatchObject({ formatter: 'biome', linter: 'biome' })
    expect(result.cliArgs).toEqual([])
  })

  test('takes recommendations from the selected framework', () => {
    const result = resolveStackConfiguration({ framework: 'next' }, frameworkSupport)

    expect(result.configuration).toEqual({
      framework: 'next',
      database: 'prisma',
      auth: 'better-auth',
      trpc: false,
      mailer: 'brevo',
      formatter: 'prettier',
      linter: 'oxlint',
      minimal: false,
    })
    expect(result.conflicts).toEqual([])
    expect(result.reasons).toEqual([
      { axis: 'framework', kind: 'explicit', message: 'requested', value: 'next' },
      {
        axis: 'database',
        kind: 'recommended',
        message: 'applicable recommendation',
        value: 'prisma',
      },
      {
        axis: 'auth',
        kind: 'recommended',
        message: 'applicable recommendation',
        value: 'better-auth',
      },
      { axis: 'trpc', kind: 'recommended', message: 'applicable recommendation', value: false },
      { axis: 'mailer', kind: 'recommended', message: 'applicable recommendation', value: 'brevo' },
      {
        axis: 'formatter',
        kind: 'recommended',
        message: 'applicable recommendation',
        value: 'prettier',
      },
      {
        axis: 'linter',
        kind: 'recommended',
        message: 'applicable recommendation',
        value: 'oxlint',
      },
    ])
  })

  test('completes dependencies and falls back with the selected framework preferences', () => {
    const completed = resolveStackConfiguration(
      { framework: 'next', minimal: true, auth: 'better-auth' },
      frameworkSupport,
    )

    expect(completed.configuration).toMatchObject({ database: 'prisma', mailer: 'brevo' })
    expect(completed.reasons).toEqual(
      expect.arrayContaining([
        {
          axis: 'database',
          kind: 'dependency',
          message: 'dependency completion for Better Auth',
          value: 'prisma',
        },
        {
          axis: 'mailer',
          kind: 'dependency',
          message: 'dependency completion for Better Auth',
          value: 'brevo',
        },
      ]),
    )

    const withoutDatabase = resolveStackConfiguration(
      { framework: 'next', database: 'none' },
      frameworkSupport,
    )
    expect(withoutDatabase.configuration).toMatchObject({ auth: 'clerk', mailer: 'none' })
  })

  test.each(Object.entries(FRAMEWORK_SUPPORT))(
    '%s recommends only values it supports',
    (_framework, { supports, recommendations }) => {
      expect(supports.database).toEqual(expect.arrayContaining([...recommendations.database]))
      expect(supports.auth).toEqual(expect.arrayContaining([...recommendations.auth]))
      expect(supports.trpc).toContain(recommendations.trpc)
      expect(supports.mailer).toEqual(expect.arrayContaining([...recommendations.mailer]))
      expect(supports.formatter).toContain(recommendations.formatter)
      expect(supports.linter).toContain(recommendations.linter)
    },
  )

  test('declares Next.js and TanStack Start as stable frameworks', () => {
    expect(
      Object.entries(FRAMEWORK_SUPPORT).map(([id, { label, maturity }]) => ({
        id,
        label,
        maturity,
      })),
    ).toEqual([
      { id: 'tanstack', label: 'TanStack Start', maturity: 'stable' },
      { id: 'next', label: 'Next.js', maturity: 'stable' },
    ])
  })
})
