import { STACK_ROOT } from './paths.mjs'
import { copy, exists, join, readJSON, remove, write } from './util.mjs'

const EMAIL_DIR = 'src/server/email'
const MAILER_PKG = join(STACK_ROOT, 'packages/mailer')
const MAILER_ADAPTERS = ['resend', 'brevo', 'ses']
const baseEmailDir = (framework) => join(STACK_ROOT, 'apps', `${framework}-base`, EMAIL_DIR)

const FACTORY = {
  resend: {
    import: "import { resendAdapter } from './adapters/resend'",
    adapter: 'resendAdapter({ apiKey: env.RESEND_API_KEY })',
    envKeys: ['EMAIL_FROM', 'RESEND_API_KEY'],
    requiredEnvKeys: ['RESEND_API_KEY'],
    pkgDep: 'resend',
  },
  brevo: {
    import: "import { brevoAdapter } from './adapters/brevo'",
    adapter: 'brevoAdapter({ apiKey: env.BREVO_API_KEY })',
    envKeys: ['EMAIL_FROM', 'BREVO_API_KEY'],
    requiredEnvKeys: ['BREVO_API_KEY'],
    pkgDep: '@getbrevo/brevo',
  },
  ses: {
    import: "import { sesAdapter } from './adapters/ses'",
    adapter: 'sesAdapter()',
    envKeys: ['EMAIL_FROM', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    requiredEnvKeys: [],
    pkgDep: '@aws-sdk/client-sesv2',
  },
}

const INDEX_TS = (cfg) => `import type { ReactElement } from 'react'
import { env } from '~/env'
${cfg.import}
import { createMailer } from './factory'
import type { MailAddress, Mailer } from './port'

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

export function swapMailer(projectDir, provider) {
  if (provider === 'resend') {
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

  remove(join(projectDir, EMAIL_DIR, 'adapters/resend.ts'))
  copy(
    join(STACK_ROOT, 'packages/mailer/src/adapters', `${provider}.ts`),
    join(projectDir, EMAIL_DIR, 'adapters', `${provider}.ts`),
  )
  write(join(projectDir, EMAIL_DIR, 'index.ts'), INDEX_TS(cfg))

  const mailerPkg = readJSON(join(STACK_ROOT, 'packages/mailer/package.json'))
  const range = mailerPkg.dependencies?.[cfg.pkgDep] ?? 'latest'
  return {
    addDeps: { [cfg.pkgDep]: range },
    removeDeps: ['resend'],
    envKeys: cfg.envKeys,
    requiredEnvKeys: cfg.requiredEnvKeys,
  }
}

export function vendorMailer(projectDir, framework, adapter, keep) {
  const cfg = FACTORY[adapter]
  if (!cfg)
    throw new Error(`Unknown mailer adapter: ${adapter} (have ${MAILER_ADAPTERS.join(', ')})`)
  const dir = join(projectDir, EMAIL_DIR)

  if (!exists(join(dir, 'index.ts'))) copy(baseEmailDir(framework), dir)
  if (adapter !== 'resend')
    copy(join(MAILER_PKG, 'src/adapters', `${adapter}.ts`), join(dir, 'adapters', `${adapter}.ts`))
  if (!keep)
    for (const a of MAILER_ADAPTERS) if (a !== adapter) remove(join(dir, 'adapters', `${a}.ts`))
  write(join(dir, 'index.ts'), INDEX_TS(cfg))

  const mailerPkg = readJSON(join(MAILER_PKG, 'package.json'))
  const range = (d) => mailerPkg.dependencies?.[d] ?? mailerPkg.peerDependencies?.[d] ?? 'latest'
  const addDeps = Object.fromEntries([cfg.pkgDep, 'react-email'].map((d) => [d, range(d)]))
  const removeDeps = keep
    ? []
    : MAILER_ADAPTERS.filter((a) => a !== adapter).map((a) => FACTORY[a].pkgDep)
  return { addDeps, removeDeps, envKeys: cfg.envKeys, requiredEnvKeys: cfg.requiredEnvKeys }
}
