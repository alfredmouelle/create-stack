// Pure argv parsing + selection normalization, split out of index.mjs to be unit-testable.

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
  // Boolean options never consume a following positional; other options may use
  // either a separated value or their documented bare recommendation.
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

/** Minimal flag parser: positionals plus separated or equals-style option values. */
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

/** Normalize the --mono flag: absent → false, bare/`turbo` → 'turborepo', `nx` → 'nx'. */
export function resolveMonorepo(v) {
  if (v == null || v === false) return false
  if (v === true || v === 'turbo') return 'turborepo'
  if (v === 'nx') return 'nx'
  throw new Error(`Invalid --monorepo value: ${JSON.stringify(v)} (expected turbo or nx)`)
}

/** Split a comma list into trimmed, non-empty tokens. */
export const csv = (v) =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

// An import-alias prefix: optional @/~/# sigil + word chars (e.g. '~', '@', '#', '@app', 'src').
export const ALIAS_RE = /^[@~#]?[\w-]*$/

const cleanAlias = (v) =>
  String(v ?? '')
    .trim()
    .replace(/\/+$/, '') // tolerate a typed-in trailing slash ('@/' → '@')

/** Is `v` a usable alias prefix? */
export const isValidAlias = (v) => {
  const t = cleanAlias(v)
  return t.length > 0 && ALIAS_RE.test(t)
}

/** Normalize an alias prefix; '' / non-string → '~'. Throws on a malformed value. */
export function normalizeAlias(v) {
  const t = cleanAlias(v)
  if (!t) return '~'
  if (!ALIAS_RE.test(t)) throw new Error(`Invalid import alias: ${JSON.stringify(v)}`)
  return t
}

/** Resolve prompt/test selections: better-auth needs a db and a mailer. */
export function resolveInteractiveStack(trpc, database, auth, mailer) {
  const adjustments = []
  let includeTrpc = trpc
  let a = auth ?? 'better-auth'
  let db = database ?? 'drizzle'

  if (db === 'convex') {
    // Convex is the API + realtime db: it replaces trpc, and can't back the
    // Postgres-coupled better-auth (only Clerk or no auth).
    if (includeTrpc) {
      includeTrpc = false
      adjustments.push('Convex is its own API layer, tRPC removed')
    }
    if (a === 'better-auth') {
      a = 'none'
      adjustments.push('better-auth needs Postgres, auth set to none (pair Convex with Clerk)')
    }
  } else if (a === 'better-auth' && db === 'none') {
    // Better Auth needs a database; tRPC is an independent API axis.
    db = 'drizzle'
    adjustments.push('better-auth needs a database, Drizzle added')
  }

  // better-auth sends its own emails via the mailer; clerk is hosted and needs none.
  let mailerProvider = mailer ?? 'resend'
  if (a === 'better-auth' && mailerProvider === 'none') {
    mailerProvider = 'resend'
    adjustments.push('better-auth sends its own emails, Resend added')
  }
  return { trpc: includeTrpc, database: db, auth: a, mailerProvider, adjustments }
}
