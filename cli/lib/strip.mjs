// Step A3 — reverse-strip the foundations the user did NOT select.
// Whole-directory deletes (robust against orphans) + the few code "seams"
// that need surgery (trpc/auth wiring) via shipped reduced variants.

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { foundationManifest } from './manifests.mjs'
import { copy, editFile, join, remove } from './util.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const tpl = (rel) => join(here, '..', 'templates', rel)

const ALWAYS_KEEP = new Set(['valibot'])

const manifestDeps = (m) => [...(m?.deps ?? []), ...(m?.devDeps ?? [])]

/** Logical foundations always present in a base app. */
export const FOUNDATIONS = ['drizzle', 'trpc', 'better-auth', 'data-table']

/**
 * Strip the unselected foundations from the fork.
 * @returns {{ removeDeps: string[], removeScripts: string[] }}
 */
export function stripFoundations({ projectDir, framework, kept, keptMailer, patterns }) {
  const next = framework === 'next'
  const src = (p) => join(projectDir, 'src', p)
  const dropped = FOUNDATIONS.filter((f) => !kept.has(f))

  // Dep diff: remove a dropped foundation's deps unless a kept one still needs it.
  const keptDeps = new Set(
    [...kept].flatMap((f) => manifestDeps(patterns[foundationManifest(f, framework)])),
  )
  const removeDeps = new Set()
  const removeScripts = new Set()
  for (const f of dropped) {
    const m = patterns[foundationManifest(f, framework)]
    for (const d of manifestDeps(m)) {
      if (!keptDeps.has(d) && !ALWAYS_KEEP.has(d)) removeDeps.add(d)
    }
    for (const s of Object.keys(m?.scripts ?? {})) removeScripts.add(s)
  }

  // --- data-table ---
  if (dropped.includes('data-table')) {
    for (const f of ['data-table.tsx', 'infinite-data-table.tsx', 'sortable-header.tsx']) {
      remove(src(join('components', f)))
    }
  }

  // --- trpc (delete dirs + swap root wiring) ---
  if (dropped.includes('trpc')) {
    remove(src('trpc'))
    remove(src('server/api'))
    if (next) {
      remove(src('app/api/trpc'))
      copy(tpl('next/layout.no-trpc.tsx'), src('app/layout.tsx'))
    } else {
      remove(src('routes/api.trpc.$.tsx'))
      copy(tpl('tanstack/router.no-trpc.tsx'), src('router.tsx'))
      copy(tpl('tanstack/__root.no-trpc.tsx'), src('routes/__root.tsx'))
      // extra TanStack wiring deps that only make sense with trpc/react-query
      for (const d of [
        '@tanstack/react-query',
        '@tanstack/react-query-devtools',
        '@tanstack/react-router-ssr-query',
        'superjson',
      ]) {
        if (!keptDeps.has(d)) removeDeps.add(d)
      }
    }
  }

  // --- better-auth ---
  if (dropped.includes('better-auth')) {
    remove(src('server/better-auth'))
    remove(src('server/db/schemas/auth.schema.ts'))
    if (next) {
      remove(src('app/auth'))
      remove(src('app/api/auth'))
      remove(src('app/dashboard'))
      remove(src('server/auth'))
      remove(src('features/auth'))
    } else {
      remove(src('routes/auth.tsx'))
      remove(src('routes/auth'))
      remove(src('routes/_authed.tsx'))
      remove(src('routes/_authed'))
      remove(src('routes/api/auth'))
      remove(src('features/auth'))
    }
    // drop the auth.schema barrel line (kept drizzle owns the barrel)
    editFile(src('server/db/schemas/index.ts'), (c) => {
      const out = c
        .split('\n')
        .filter((l) => !l.includes("'./auth.schema'"))
        .join('\n')
      // keep it a module even when empty, so `import * as schema` still resolves
      return /^export /m.test(out) ? out : `${out.trimEnd()}\nexport {}\n`
    })
    // if trpc survives, strip auth out of its context
    if (kept.has('trpc')) editFile(src('server/api/trpc.ts'), stripAuthFromTrpc)
  }

  // --- mailer / email-kit (inlined in the base; needed only by better-auth) ---
  if (!keptMailer) {
    remove(src('server/email'))
    remove(src('emails'))
    for (const d of ['resend', 'react-email']) removeDeps.add(d)
    removeScripts.add('email:dev')
  }

  // --- drizzle (only droppable when nothing depends on it) ---
  if (dropped.includes('drizzle')) {
    remove(src('server/db'))
    remove(join(projectDir, 'drizzle.config.ts'))
  }

  return { removeDeps: [...removeDeps], removeScripts: [...removeScripts] }
}

/** Remove better-auth coupling from a tRPC context file (both frameworks). */
function stripAuthFromTrpc(src) {
  return src
    .replace(
      "import { initTRPC, TRPCError } from '@trpc/server'",
      "import { initTRPC } from '@trpc/server'",
    )
    .replace("import { auth } from '~/server/better-auth'\n", '')
    .replace('  const session = await auth.api.getSession({ headers: opts.headers })\n', '')
    .replace('return { db, session, ...opts }', 'return { db, ...opts }')
    .replace(/\n+export const protectedProcedure = t\.procedure[\s\S]*$/, '\n')
}
