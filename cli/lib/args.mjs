// Pure argv parsing + selection normalization, split out of index.mjs to be unit-testable.

export const ALL_FOUNDATIONS = ['trpc']

/** Minimal flag parser: positional args + --key value / --flag / short -abc booleans. */
export function parseArgs(argv) {
  const out = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      // a value can't start with '-', so `--no-install -y` keeps -y as its own flag.
      if (next && !next.startsWith('-')) {
        out.flags[key] = next
        i++
      } else {
        out.flags[key] = true
      }
    } else if (a.length > 1 && a[0] === '-') {
      for (const ch of a.slice(1)) out.flags[ch] = true
    } else {
      out._.push(a)
    }
  }
  return out
}

/** Normalize the --monorepo flag: absent → false, bare/`turbo` → 'turborepo', `nx` → 'nx'. */
export function resolveMonorepo(v) {
  if (v == null || v === false) return false
  if (v === true || v === 'turbo' || v === 'turborepo') return 'turborepo'
  if (v === 'nx') return 'nx'
  throw new Error(`Invalid --monorepo value: ${JSON.stringify(v)} (expected 'turbo' or 'nx')`)
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

/** Resolve foundation/axis dependencies: trpc + better-auth need a db, better-auth needs a mailer. */
export function normalize(picked, database, auth, mailer) {
  const kept = new Set(picked.filter((f) => ALL_FOUNDATIONS.includes(f)))
  const adjustments = []
  let a = auth ?? 'better-auth'
  let db = database ?? 'drizzle'

  if (db === 'convex') {
    // Convex is the API + realtime db: it replaces trpc, and can't back the
    // Postgres-coupled better-auth (only Clerk or no auth).
    if (kept.has('trpc')) {
      kept.delete('trpc')
      adjustments.push('Convex is its own API layer, tRPC removed')
    }
    if (a === 'better-auth') {
      a = 'none'
      adjustments.push('better-auth needs Postgres, auth set to none (pair Convex with Clerk)')
    }
  } else if ((kept.has('trpc') || a === 'better-auth') && db === 'none') {
    // trpc and better-auth both need a database; clerk/none don't. Fall back to the default.
    db = 'drizzle'
    adjustments.push('tRPC / better-auth need a database, Drizzle added')
  }

  // better-auth sends its own emails via the mailer; clerk is hosted and needs none.
  let mailerProvider = mailer ?? 'resend'
  if (a === 'better-auth' && mailerProvider === 'none') {
    mailerProvider = 'resend'
    adjustments.push('better-auth sends its own emails, Resend added')
  }
  return { kept, database: db, auth: a, mailerProvider, adjustments }
}
