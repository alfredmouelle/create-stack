// Mailer provider swap. The base inlines the Resend adapter; if the user picks
// another provider we swap the adapter files + the composition root (email/index.ts)
// and return the dep/env deltas. Mirrors the mailer capability manifest.

import { STACK_ROOT } from './manifests.mjs'
import { copy, join, readJSON, remove, write } from './util.mjs'

const EMAIL_DIR = 'src/server/email'

/** getMailer() body per provider (composition root in email/index.ts). */
const FACTORY = {
  brevo: {
    import: "import { brevoAdapter } from './adapters/brevo/index'",
    adapter: "brevoAdapter({ apiKey: required(env.BREVO_API_KEY, 'BREVO_API_KEY') })",
    envKeys: ['EMAIL_FROM', 'BREVO_API_KEY'],
    pkgDep: '@getbrevo/brevo',
  },
  ses: {
    import: "import { sesAdapter } from './adapters/ses/index'",
    // SESv2 SDK reads AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from env.
    adapter: 'sesAdapter()',
    envKeys: ['EMAIL_FROM', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    pkgDep: '@aws-sdk/client-sesv2',
  },
}

const REQUIRED_HELPER = `
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(\`\${name} is required to send email\`)
  return value
}
`

const INDEX_TS = (cfg) => `import type { ReactElement } from 'react'
import { env } from '~/env'
${cfg.import}
import type { MailAddress, Mailer } from './core/port'
import { createMailer } from './factory'

export type EmailRecipient = MailAddress
${cfg.adapter.includes('required(') ? REQUIRED_HELPER : ''}
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

/**
 * Swap the inlined mailer to `provider`. Returns { addDeps, removeDeps, envKeys }.
 * provider === 'resend' is a no-op (the base default).
 */
export function swapMailer(projectDir, provider) {
  if (provider === 'resend') {
    return { addDeps: {}, removeDeps: [], envKeys: ['EMAIL_FROM', 'RESEND_API_KEY'] }
  }
  const cfg = FACTORY[provider]
  if (!cfg) throw new Error(`Unknown mailer provider: ${provider}`)

  // Swap adapter files: drop resend, copy the chosen adapter from the package.
  remove(join(projectDir, EMAIL_DIR, 'adapters/resend'))
  copy(
    join(STACK_ROOT, 'packages/mailer/src/adapters', provider),
    join(projectDir, EMAIL_DIR, 'adapters', provider),
  )

  // Rewrite the composition root.
  write(join(projectDir, EMAIL_DIR, 'index.ts'), INDEX_TS(cfg))

  // Dep delta — pull the provider's range from the mailer package manifest.
  const mailerPkg = readJSON(join(STACK_ROOT, 'packages/mailer/package.json'))
  const range = mailerPkg.dependencies?.[cfg.pkgDep] ?? 'latest'
  return {
    addDeps: { [cfg.pkgDep]: range },
    removeDeps: ['resend'],
    envKeys: cfg.envKeys,
  }
}
