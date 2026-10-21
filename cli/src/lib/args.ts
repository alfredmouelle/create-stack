import type { Monorepo } from '../framework-module.ts'

export type OptionValue = string | true

export type ParsedOption = { readonly name: string; readonly value: OptionValue }

export type ParsedArgs = {
  readonly _: string[]
  readonly flags: Record<string, OptionValue>
  readonly options: ParsedOption[]
}

type OptionSink = (name: string, value: OptionValue) => void

const BOOLEAN_LONG_OPTIONS = new Set([
  'yes',
  'help',
  'version',
  'minimal',
  'trpc',
  'no-trpc',
  'no-db',
  'no-auth',
  'no-mail',
  'no-formatter',
  'no-linter',
  'no-install',
  'no-git',
  'keep',
  'keep-files',
  'force',
])

function parseLongOption(argv: readonly string[], index: number, option: OptionSink): number {
  const argument = argv[index] ?? ''
  const equals = argument.indexOf('=')
  if (equals !== -1) {
    option(argument.slice(2, equals), argument.slice(equals + 1))
    return 0
  }
  const key = argument.slice(2)
  const next = argv[index + 1]
  const isMonorepoOption = ['mono', 'monorepo'].includes(key)
  const hasExplicitMonorepoValue = isMonorepoOption && (next === 'turbo' || next === 'nx')
  if (
    !BOOLEAN_LONG_OPTIONS.has(key) &&
    next &&
    !next.startsWith('-') &&
    (!isMonorepoOption || hasExplicitMonorepoValue)
  ) {
    option(key, next)
    return 1
  }
  option(key, true)
  return 0
}

function parseShortOption(argv: readonly string[], index: number, option: OptionSink): number {
  const argument = argv[index] ?? ''
  const key = argument.charAt(1)
  if (argument.length > 2 && argument[2] === '=') {
    option(key, argument.slice(3))
    return 0
  }
  if (argument.length !== 2) {
    throw new Error(`Grouped short options are not supported: ${argument}`)
  }
  const next = argv[index + 1]
  if (!['y', 'h', 'v'].includes(key) && next && !next.startsWith('-')) {
    option(key, next)
    return 1
  }
  option(key, true)
  return 0
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { _: [], flags: {}, options: [] }
  const option: OptionSink = (name, value) => {
    out.flags[name] = value
    out.options.push({ name, value })
  }
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i] ?? ''
    if (argument.startsWith('--')) {
      i += parseLongOption(argv, i, option)
    } else if (argument.startsWith('-') && argument.length > 1) {
      i += parseShortOption(argv, i, option)
    } else {
      out._.push(argument)
    }
  }
  return out
}

export function resolveMonorepo(v: unknown): Monorepo {
  if (v == null || v === false) return false
  if (v === true || v === 'turbo') return 'turborepo'
  if (v === 'nx') return 'nx'
  throw new Error(`Invalid --monorepo value: ${JSON.stringify(v)} (expected turbo or nx)`)
}

export const csv = (v: unknown): string[] =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

export const ALIAS_RE = /^[@~#]?[\w-]*$/

const cleanAlias = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .replace(/\/+$/, '')

export const isValidAlias = (v: unknown): boolean => {
  const t = cleanAlias(v)
  return t.length > 0 && ALIAS_RE.test(t)
}

export function normalizeAlias(v: unknown): string {
  const t = cleanAlias(v)
  if (!t) return '~'
  if (!ALIAS_RE.test(t)) throw new Error(`Invalid import alias: ${JSON.stringify(v)}`)
  return t
}
