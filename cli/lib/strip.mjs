// Strip unselected foundations: whole-dir deletes + code-seam variants (trpc/auth).

import { FOUNDATIONS, foundationDeps, foundationScripts } from './foundations.mjs'
import { TEMPLATES } from './paths.mjs'
import { copy, editFile, join, remove } from './util.mjs'

const tpl = (rel) => join(TEMPLATES, rel)

const ALWAYS_KEEP = new Set(['valibot'])

// trpc dropped on TanStack also sheds react-query wiring deps.
const TANSTACK_TRPC_DEPS = [
  '@tanstack/react-query',
  '@tanstack/react-query-devtools',
  '@tanstack/react-router-ssr-query',
  'superjson',
]

const stripTrpc = (src, next, keptDeps, removeDeps) => {
  remove(src('trpc'))
  remove(src('server/api'))
  if (next) {
    remove(src('app/api/trpc'))
    copy(tpl('next/layout.no-trpc.tsx'), src('app/layout.tsx'))
    return
  }
  remove(src('routes/api.trpc.$.tsx'))
  copy(tpl('tanstack/router.no-trpc.tsx'), src('router.tsx'))
  copy(tpl('tanstack/__root.no-trpc.tsx'), src('routes/__root.tsx'))
  for (const d of TANSTACK_TRPC_DEPS) if (!keptDeps.has(d)) removeDeps.add(d)
}

const stripAuth = (src, next, kept) => {
  remove(src('server/better-auth'))
  remove(src('server/db/schemas/auth.schema.ts'))
  const dirs = next
    ? ['app/auth', 'app/api/auth', 'app/dashboard', 'server/auth', 'features/auth']
    : [
        'routes/auth.tsx',
        'routes/auth',
        'routes/_authed.tsx',
        'routes/_authed',
        'routes/api/auth',
        'features/auth',
      ]
  for (const d of dirs) remove(src(d))
  // drop the auth.schema barrel line, keeping it a module so `import * as schema` resolves
  editFile(src('server/db/schemas/index.ts'), (c) => {
    const out = c
      .split('\n')
      .filter((l) => !l.includes("'./auth.schema'"))
      .join('\n')
    return /^export /m.test(out) ? out : `${out.trimEnd()}\nexport {}\n`
  })
  if (kept.has('trpc')) editFile(src('server/api/trpc.ts'), stripAuthFromTrpc)
}

const stripMailer = (src, removeDeps, removeScripts) => {
  remove(src('server/email'))
  remove(src('emails'))
  for (const d of ['resend', 'react-email']) removeDeps.add(d)
  removeScripts.add('email:dev')
}

/** @returns {{ removeDeps: string[], removeScripts: string[] }} */
export function stripFoundations({ projectDir, framework, kept, keptMailer }) {
  const next = framework === 'next'
  const src = (p) => join(projectDir, 'src', p)
  const dropped = FOUNDATIONS.filter((f) => !kept.has(f))

  // remove a dropped foundation's deps/scripts unless a kept one still needs them
  const keptDeps = new Set([...kept].flatMap((f) => foundationDeps(f, framework)))
  const removeDeps = new Set()
  const removeScripts = new Set()
  for (const f of dropped) {
    for (const d of foundationDeps(f, framework)) {
      if (!keptDeps.has(d) && !ALWAYS_KEEP.has(d)) removeDeps.add(d)
    }
    for (const s of foundationScripts(f)) removeScripts.add(s)
  }

  if (dropped.includes('trpc')) stripTrpc(src, next, keptDeps, removeDeps)
  if (dropped.includes('better-auth')) stripAuth(src, next, kept)
  if (!keptMailer) stripMailer(src, removeDeps, removeScripts)
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
