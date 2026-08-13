// Strip unselected tRPC and mailer files from a forked base application.

import { TEMPLATES } from './paths.mjs'
import { trpcDeps } from './trpc.mjs'
import { copy, join, remove } from './util.mjs'

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
  // devtools component drops the query plugin that lived under the removed trpc dir
  copy(tpl('tanstack/devtools.no-trpc.tsx'), src('components/devtools.tsx'))
  for (const d of TANSTACK_TRPC_DEPS) if (!keptDeps.has(d)) removeDeps.add(d)
}

const stripMailer = (src, removeDeps, removeScripts) => {
  remove(src('server/email'))
  remove(src('emails'))
  for (const d of ['resend', 'react-email', '@react-email/ui']) removeDeps.add(d)
  removeScripts.add('email:dev')
}

/** @returns {{ removeDeps: string[], removeScripts: string[] }} */
export function stripUnselectedFeatures({ projectDir, framework, trpc, keptMailer }) {
  const next = framework === 'next'
  const src = (p) => join(projectDir, 'src', p)
  const keptDeps = new Set(trpc ? trpcDeps(framework) : [])
  const removeDeps = new Set()
  const removeScripts = new Set()

  if (!trpc) {
    for (const dependency of trpcDeps(framework)) {
      if (!ALWAYS_KEEP.has(dependency)) removeDeps.add(dependency)
    }
    stripTrpc(src, next, keptDeps, removeDeps)
  }

  if (!keptMailer) stripMailer(src, removeDeps, removeScripts)

  return { removeDeps: [...removeDeps], removeScripts: [...removeScripts] }
}
