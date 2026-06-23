// Pure argv parsing + selection normalization, factored out of index.mjs so it can be
// unit-tested without booting the CLI (which runs main() on import).

export const ALL_FOUNDATIONS = ['drizzle', 'trpc', 'better-auth', 'data-table']

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

/** Split a comma list into trimmed, non-empty tokens. */
export const csv = (v) =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

/** Resolve hard deps + mailer's better-auth requirement for a foundation selection. */
export function normalize(picked, mailer) {
  const kept = new Set(picked.filter((f) => ALL_FOUNDATIONS.includes(f)))
  if (kept.has('trpc') || kept.has('better-auth')) kept.add('drizzle')
  let mailerProvider = mailer ?? 'resend'
  if (kept.has('better-auth') && mailerProvider === 'none') mailerProvider = 'resend'
  return { kept, mailerProvider }
}
