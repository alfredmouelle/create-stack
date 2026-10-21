import {
  DEFAULT_IMPORT_ALIAS,
  isValidImportAlias,
  MONOREPO_ORCHESTRATORS,
  type MonorepoOrchestrator,
  normalizeImportAlias,
  SCAFFOLD_FLAGS,
  scaffoldFlag,
  scaffoldFlagSpellings,
  scaffoldFlagSwitches,
} from '@alfredmouelle/stack-config'
import type { Monorepo } from '../framework-module.ts'

export type OptionValue = string | true

export type ParsedOption = { readonly name: string; readonly value: OptionValue }

export type ParsedArgs = {
  readonly _: string[]
  readonly flags: Record<string, OptionValue>
  readonly options: ParsedOption[]
}

type OptionSink = (name: string, value: OptionValue) => void

const BOOLEAN_SCAFFOLD_OPTIONS = SCAFFOLD_FLAGS.flatMap(scaffoldFlagSwitches)

const BOOLEAN_LONG_OPTIONS = new Set([
  ...BOOLEAN_SCAFFOLD_OPTIONS.filter((name) => name.length > 1),
  'help',
  'version',
  'no-formatter',
  'no-linter',
  'keep',
  'keep-files',
  'force',
])

const BOOLEAN_SHORT_OPTIONS = new Set([
  ...BOOLEAN_SCAFFOLD_OPTIONS.filter((name) => name.length === 1),
  'h',
  'v',
])

const MONOREPO_OPTIONS = scaffoldFlagSpellings(scaffoldFlag('monorepo'))

const isMonorepoOrchestrator = (value: unknown): value is MonorepoOrchestrator =>
  MONOREPO_ORCHESTRATORS.some((orchestrator) => orchestrator === value)

function parseLongOption(argv: readonly string[], index: number, option: OptionSink): number {
  const argument = argv[index] ?? ''
  const equals = argument.indexOf('=')
  if (equals !== -1) {
    option(argument.slice(2, equals), argument.slice(equals + 1))
    return 0
  }
  const key = argument.slice(2)
  const next = argv[index + 1]
  const isMonorepoOption = MONOREPO_OPTIONS.includes(key)
  const hasExplicitMonorepoValue = isMonorepoOption && isMonorepoOrchestrator(next)
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
  if (!BOOLEAN_SHORT_OPTIONS.has(key) && next && !next.startsWith('-')) {
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

const MONOREPO_LAYOUTS: Readonly<Record<MonorepoOrchestrator, Exclude<Monorepo, false>>> = {
  turbo: 'turborepo',
  nx: 'nx',
}

const orchestratorList = new Intl.ListFormat('en', { type: 'disjunction' })

export function resolveMonorepo(v: unknown): Monorepo {
  if (v == null || v === false) return false
  if (v === true) return MONOREPO_LAYOUTS.turbo
  if (isMonorepoOrchestrator(v)) return MONOREPO_LAYOUTS[v]
  throw new Error(
    `Invalid --monorepo value: ${JSON.stringify(v)} (expected ${orchestratorList.format(MONOREPO_ORCHESTRATORS)})`,
  )
}

export const csv = (v: unknown): string[] =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

export const isValidAlias = (v: unknown): boolean => isValidImportAlias(String(v ?? ''))

export function normalizeAlias(v: unknown): string {
  const t = normalizeImportAlias(String(v ?? ''))
  if (!t) return DEFAULT_IMPORT_ALIAS
  if (!isValidImportAlias(t)) throw new Error(`Invalid import alias: ${JSON.stringify(v)}`)
  return t
}
