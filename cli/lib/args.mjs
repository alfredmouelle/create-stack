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
  'no-install',
  'no-git',
  'keep',
  'keep-files',
  'force',
])

function parseLongOption(argv, index, option) {
  const argument = argv[index]
  const equals = argument.indexOf('=')
  if (equals !== -1) {
    option(argument.slice(2, equals), argument.slice(equals + 1))
    return 0
  }
  const key = argument.slice(2)
  const next = argv[index + 1]
  const isMonorepoOption = ['mono', 'monorepo'].includes(key)
  const hasExplicitMonorepoValue = isMonorepoOption && ['turbo', 'nx'].includes(next)
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

function parseShortOption(argv, index, option) {
  const argument = argv[index]
  if (argument.length > 2 && argument[2] === '=') {
    option(argument[1], argument.slice(3))
    return 0
  }
  if (argument.length !== 2) {
    throw new Error(`Grouped short options are not supported: ${argument}`)
  }
  const key = argument[1]
  const next = argv[index + 1]
  if (!['y', 'h', 'v'].includes(key) && next && !next.startsWith('-')) {
    option(key, next)
    return 1
  }
  option(key, true)
  return 0
}

export function parseArgs(argv) {
  const out = { _: [], flags: {}, options: [] }
  const option = (name, value) => {
    out.flags[name] = value
    out.options.push({ name, value })
  }
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]
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

export function resolveMonorepo(v) {
  if (v == null || v === false) return false
  if (v === true || v === 'turbo') return 'turborepo'
  if (v === 'nx') return 'nx'
  throw new Error(`Invalid --monorepo value: ${JSON.stringify(v)} (expected turbo or nx)`)
}

export const csv = (v) =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

export const ALIAS_RE = /^[@~#]?[\w-]*$/

const cleanAlias = (v) =>
  String(v ?? '')
    .trim()
    .replace(/\/+$/, '')

export const isValidAlias = (v) => {
  const t = cleanAlias(v)
  return t.length > 0 && ALIAS_RE.test(t)
}

export function normalizeAlias(v) {
  const t = cleanAlias(v)
  if (!t) return '~'
  if (!ALIAS_RE.test(t)) throw new Error(`Invalid import alias: ${JSON.stringify(v)}`)
  return t
}
