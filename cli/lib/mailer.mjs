// Mailer provider swap. Base inlines Resend; other providers swap adapter files +
// composition root (email/index.ts) and return dep/env deltas. Mirrors the mailer manifest.

import { STACK_ROOT } from './paths.mjs'
import { copy, exists, join, readJSON, remove, write } from './util.mjs'

const EMAIL_DIR = 'src/server/email'
const MAILER_PKG = join(STACK_ROOT, 'packages/mailer')
const MAILER_ADAPTERS = ['resend', 'brevo', 'ses']
const baseEmailDir = (framework) => join(STACK_ROOT, 'apps', `${framework}-base`, EMAIL_DIR)

/** getMailer() body per provider (composition root). */
const FACTORY = {
  resend: {
    import: "import { resendAdapter } from './adapters/resend/index'",
    adapter: 'resendAdapter({ apiKey: env.RESEND_API_KEY })',
    envKeys: ['EMAIL_FROM', 'RESEND_API_KEY'],
    requiredEnvKeys: ['RESEND_API_KEY'],
    pkgDep: 'resend',
  },
  brevo: {
    import: "import { brevoAdapter } from './adapters/brevo/index'",
    adapter: 'brevoAdapter({ apiKey: env.BREVO_API_KEY })',
    envKeys: ['EMAIL_FROM', 'BREVO_API_KEY'],
    requiredEnvKeys: ['BREVO_API_KEY'],
    pkgDep: '@getbrevo/brevo',
  },
  ses: {
    import: "import { sesAdapter } from './adapters/ses/index'",
    // SESv2 SDK reads AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from env
    // (or the wider AWS credential chain), so none are hard-required at boot.
    adapter: 'sesAdapter()',
    envKeys: ['EMAIL_FROM', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    requiredEnvKeys: [],
    pkgDep: '@aws-sdk/client-sesv2',
  },
}

// env.ts is the source of truth: a kept mailer's API key is emitted as required there,
// so env.X is already a guaranteed string — the composition root reads it directly.
const INDEX_TS = (cfg) => `import type { ReactElement } from 'react'
import { env } from '~/env'
${cfg.import}
import type { MailAddress, Mailer } from './core/port'
import { createMailer } from './factory'

export type EmailRecipient = MailAddress

let mailer: Mailer | null = null
function getMailer(): Mailer {
  if (!mailer) {
    mailer = createMailer({
      from: env.EMAIL_FROM,
      adapter: ${cfg.adapter},
    })
  }
  return mailer
}

export async function sendEmail(params: {
  to: EmailRecipient
  subject: string
  template: ReactElement
}) {
  return getMailer().send({
    to: params.to,
    subject: params.subject,
    react: params.template,
  })
}
`

/** Swap inlined mailer to `provider` → { addDeps, removeDeps, envKeys, requiredEnvKeys }. */
export function swapMailer(projectDir, provider) {
  if (provider === 'resend') {
    // base ships the resend adapter; rewrite only the composition root so the generated
    // project reads env directly (env.ts marks RESEND_API_KEY required) — no lazy guard.
    write(join(projectDir, EMAIL_DIR, 'index.ts'), INDEX_TS(FACTORY.resend))
    return {
      addDeps: {},
      removeDeps: [],
      envKeys: ['EMAIL_FROM', 'RESEND_API_KEY'],
      requiredEnvKeys: ['RESEND_API_KEY'],
    }
  }
  const cfg = FACTORY[provider]
  if (!cfg) throw new Error(`Unknown mailer provider: ${provider}`)

  // swap adapter files: drop resend, copy chosen adapter from package
  remove(join(projectDir, EMAIL_DIR, 'adapters/resend'))
  copy(
    join(STACK_ROOT, 'packages/mailer/src/adapters', provider),
    join(projectDir, EMAIL_DIR, 'adapters', provider),
  )

  // rewrite composition root
  write(join(projectDir, EMAIL_DIR, 'index.ts'), INDEX_TS(cfg))

  // dep delta — pull provider's range from mailer package manifest
  const mailerPkg = readJSON(join(STACK_ROOT, 'packages/mailer/package.json'))
  const range = mailerPkg.dependencies?.[cfg.pkgDep] ?? 'latest'
  return {
    addDeps: { [cfg.pkgDep]: range },
    removeDeps: ['resend'],
    envKeys: cfg.envKeys,
    requiredEnvKeys: cfg.requiredEnvKeys,
  }
}

/**
 * Add/swap the mailer in an existing project (the `add` path). Copies the base port if
 * absent, vendors the target adapter, and points the composition root at it. `keep`
 * retains the other adapters (+ their deps); otherwise they're dropped for a clean swap.
 * @returns {{ addDeps, removeDeps, envKeys, requiredEnvKeys }}
 */
export function vendorMailer(projectDir, framework, adapter, keep) {
  const cfg = FACTORY[adapter]
  if (!cfg)
    throw new Error(`Unknown mailer adapter: ${adapter} (have ${MAILER_ADAPTERS.join(', ')})`)
  const dir = join(projectDir, EMAIL_DIR)

  if (!exists(join(dir, 'index.ts'))) copy(baseEmailDir(framework), dir) // resend baseline port
  if (adapter !== 'resend')
    copy(join(MAILER_PKG, 'src/adapters', adapter), join(dir, 'adapters', adapter))
  if (!keep) for (const a of MAILER_ADAPTERS) if (a !== adapter) remove(join(dir, 'adapters', a))
  write(join(dir, 'index.ts'), INDEX_TS(cfg))

  const mailerPkg = readJSON(join(MAILER_PKG, 'package.json'))
  const range = (d) => mailerPkg.dependencies?.[d] ?? 'latest'
  const addDeps = Object.fromEntries(
    [cfg.pkgDep, 'valibot', '@react-email/render'].map((d) => [d, range(d)]),
  )
  const removeDeps = keep
    ? []
    : MAILER_ADAPTERS.filter((a) => a !== adapter).map((a) => FACTORY[a].pkgDep)
  return { addDeps, removeDeps, envKeys: cfg.envKeys, requiredEnvKeys: cfg.requiredEnvKeys }
}
