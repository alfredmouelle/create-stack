// Mailer provider swap. Base inlines Resend; other providers swap adapter files +
// composition root (email/index.ts) and return dep/env deltas. Mirrors the mailer manifest.

import { STACK_ROOT } from './paths.mjs'
import { copy, join, readJSON, remove, write } from './util.mjs'

const EMAIL_DIR = 'src/server/email'

/** getMailer() body per provider (composition root). */
const FACTORY = {
  brevo: {
    import: "import { brevoAdapter } from './adapters/brevo/index'",
    adapter: "brevoAdapter({ apiKey: required(env.BREVO_API_KEY, 'BREVO_API_KEY') })",
    envKeys: ['EMAIL_FROM', 'BREVO_API_KEY'],
    pkgDep: '@getbrevo/brevo',
  },
  ses: {
    import: "import { sesAdapter } from './adapters/ses/index'",
    // SESv2 SDK reads AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from env
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

/** Swap inlined mailer to `provider` → { addDeps, removeDeps, envKeys }. 'resend' is a no-op (base default). */
export function swapMailer(projectDir, provider) {
  if (provider === 'resend') {
    return { addDeps: {}, removeDeps: [], envKeys: ['EMAIL_FROM', 'RESEND_API_KEY'] }
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
  }
}
