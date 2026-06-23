import { describe, expect, test } from 'vitest'
import { csv, isValidAlias, normalize, normalizeAlias, parseArgs } from '../lib/args.mjs'

describe('parseArgs', () => {
  test('positionals + --key value', () => {
    const { _, flags } = parseArgs(['my-app', '--framework', 'next', '--mailer', 'ses'])
    expect(_).toEqual(['my-app'])
    expect(flags).toMatchObject({ framework: 'next', mailer: 'ses' })
  })

  test('bare --flag is boolean', () => {
    expect(parseArgs(['--no-install']).flags['no-install']).toBe(true)
  })

  test('short flags: -y and grouped -hv', () => {
    expect(parseArgs(['-y']).flags.y).toBe(true)
    const { flags } = parseArgs(['-hv'])
    expect(flags).toMatchObject({ h: true, v: true })
  })

  test('a value starting with - is not swallowed', () => {
    // regression: `--no-install -y` must keep -y as its own flag, not its value
    const { flags } = parseArgs(['--mailer', '-y'])
    expect(flags.mailer).toBe(true)
    expect(flags.y).toBe(true)
  })

  test('subcommand-style positionals', () => {
    expect(parseArgs(['add', 'storage', 's3'])._).toEqual(['add', 'storage', 's3'])
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

describe('normalize', () => {
  test('trpc pulls in drizzle', () => {
    const { kept } = normalize(['trpc'], 'resend')
    expect([...kept].sort()).toEqual(['drizzle', 'trpc'])
  })
  test('better-auth pulls drizzle and forces a real mailer', () => {
    const { kept, mailerProvider } = normalize(['better-auth'], 'none')
    expect(kept.has('drizzle')).toBe(true)
    expect(kept.has('better-auth')).toBe(true)
    expect(mailerProvider).toBe('resend')
  })
  test('keeps an explicit mailer + drops unknown foundations', () => {
    const { kept, mailerProvider } = normalize(['drizzle', 'bogus'], 'ses')
    expect([...kept]).toEqual(['drizzle'])
    expect(mailerProvider).toBe('ses')
  })
  test('none mailer survives without better-auth', () => {
    expect(normalize(['data-table'], 'none').mailerProvider).toBe('none')
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
