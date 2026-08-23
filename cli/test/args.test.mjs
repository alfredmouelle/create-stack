import { describe, expect, test } from 'vitest'
import { csv, isValidAlias, normalizeAlias, parseArgs } from '../lib/args.mjs'
import { resolveCreationConfiguration } from '../lib/stack-config.mjs'

describe('parseArgs', () => {
  test('positionals + --key value', () => {
    const { _, flags } = parseArgs(['my-app', '--framework', 'next', '--mailer', 'ses'])
    expect(_).toEqual(['my-app'])
    expect(flags).toMatchObject({ framework: 'next', mailer: 'ses' })
  })

  test('bare --flag is boolean', () => {
    expect(parseArgs(['--no-install']).flags['no-install']).toBe(true)
  })

  test('accepts a single short flag and rejects grouped short flags', () => {
    expect(parseArgs(['-y']).flags.y).toBe(true)
    expect(() => parseArgs(['-hv'])).toThrow('Grouped short options are not supported')
  })

  test('a value starting with - is not swallowed', () => {
    const { flags } = parseArgs(['--mailer', '-y'])
    expect(flags.mailer).toBe(true)
    expect(flags.y).toBe(true)
  })

  test('subcommand-style positionals', () => {
    expect(parseArgs(['add', 'storage', 's3'])._).toEqual(['add', 'storage', 's3'])
  })

  test('boolean options do not consume a following positional', () => {
    expect(parseArgs(['--no-install', 'my-app'])).toMatchObject({
      _: ['my-app'],
      flags: { 'no-install': true },
    })
  })

  test('bare monorepo options do not consume a following project target', () => {
    expect(parseArgs(['--mono', 'my-app'])).toMatchObject({
      _: ['my-app'],
      flags: { mono: true },
    })
    expect(parseArgs(['--monorepo', 'nx', 'my-app'])).toMatchObject({
      _: ['my-app'],
      flags: { monorepo: 'nx' },
    })
  })
})

describe('csv', () => {
  test('trims + drops empties', () => {
    expect(csv('a, b ,,c')).toEqual(['a', 'b', 'c'])
  })
  test('non-strings → []', () => {
    expect(csv(undefined)).toEqual([])
    expect(csv(true)).toEqual([])
  })
})

describe('resolveCreationConfiguration', () => {
  test('trpc remains independent when the database is excluded', () => {
    const { trpc, database } = resolveCreationConfiguration({
      trpc: true,
      database: 'none',
      auth: 'none',
      mailer: 'resend',
    })
    expect(trpc).toBe(true)
    expect(database).toBe('none')
  })
  test('better-auth completes omitted database and mailer dependencies', () => {
    const { database, auth, mailerProvider } = resolveCreationConfiguration({
      trpc: false,
      auth: 'better-auth',
    })
    expect(auth).toBe('better-auth')
    expect(database).toBe('drizzle')
    expect(mailerProvider).toBe('resend')
  })
  test('clerk needs neither a database nor a mailer', () => {
    const { database, auth, mailerProvider } = resolveCreationConfiguration({
      trpc: false,
      database: 'none',
      auth: 'clerk',
      mailer: 'none',
    })
    expect(auth).toBe('clerk')
    expect(database).toBe('none')
    expect(mailerProvider).toBe('none')
  })
  test('keeps the chosen ORM and mailer when tRPC is excluded', () => {
    const { trpc, database, mailerProvider } = resolveCreationConfiguration({
      trpc: false,
      database: 'prisma',
      auth: 'none',
      mailer: 'ses',
    })
    expect(trpc).toBe(false)
    expect(database).toBe('prisma')
    expect(mailerProvider).toBe('ses')
  })
  test('a minimal project keeps no database, auth, mailer, or tRPC', () => {
    const { trpc, database, auth, mailerProvider } = resolveCreationConfiguration({ minimal: true })
    expect(trpc).toBe(false)
    expect(database).toBe('none')
    expect(auth).toBe('none')
    expect(mailerProvider).toBe('none')
  })
})

describe('normalizeAlias', () => {
  test('empty / non-string → default ~', () => {
    expect(normalizeAlias(undefined)).toBe('~')
    expect(normalizeAlias('')).toBe('~')
    expect(normalizeAlias('   ')).toBe('~')
  })
  test('keeps common prefixes and strips a trailing slash', () => {
    expect(normalizeAlias('@')).toBe('@')
    expect(normalizeAlias('@/')).toBe('@')
    expect(normalizeAlias('#')).toBe('#')
    expect(normalizeAlias(' @app ')).toBe('@app')
  })
  test('throws on a malformed alias', () => {
    expect(() => normalizeAlias('foo/bar')).toThrow()
    expect(() => normalizeAlias('@@')).toThrow()
    expect(() => normalizeAlias('a b')).toThrow()
  })
})

describe('isValidAlias', () => {
  test('accepts prefixes, rejects junk', () => {
    expect(isValidAlias('@')).toBe(true)
    expect(isValidAlias('~')).toBe(true)
    expect(isValidAlias('@app')).toBe(true)
    expect(isValidAlias('')).toBe(false)
    expect(isValidAlias('a/b')).toBe(false)
  })
})
