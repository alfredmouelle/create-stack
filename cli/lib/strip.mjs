import { TEMPLATES } from './paths.mjs'
import { trpcDeps } from './trpc.mjs'
import { copy, join, remove } from './util.mjs'

const tpl = (rel) => join(TEMPLATES, rel)

const ALWAYS_KEEP = new Set(['valibot'])

const stripTrpc = (src) => {
  remove(src('trpc'))
  remove(src('server/api'))
  remove(src('app/api/trpc'))
  copy(tpl('next/layout.no-trpc.tsx'), src('app/layout.tsx'))
}

const stripMailer = (src, removeDeps, removeScripts) => {
  remove(src('server/email'))
  remove(src('emails'))
  for (const d of ['resend', 'react-email', '@react-email/ui']) removeDeps.add(d)
  removeScripts.add('email:dev')
}

export function stripUnselectedFeatures({ projectDir, framework, trpc, keptMailer }) {
  const src = (p) => join(projectDir, 'src', p)
  const removeDeps = new Set()
  const removeScripts = new Set()

  if (!trpc) {
    for (const dependency of trpcDeps(framework)) {
      if (!ALWAYS_KEEP.has(dependency)) removeDeps.add(dependency)
    }
    stripTrpc(src)
  }

  if (!keptMailer) stripMailer(src, removeDeps, removeScripts)

  return { removeDeps: [...removeDeps], removeScripts: [...removeScripts] }
}
