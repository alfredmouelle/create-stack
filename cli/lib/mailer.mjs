import { stripJsExtensions } from './capabilities.mjs'
import { STACK_ROOT } from './paths.mjs'
import { copy, exists, join, read, readJSON, remove, write } from './util.mjs'

const EMAIL_DIR = 'src/server/email'
const MAILER_PKG = join(STACK_ROOT, 'packages/mailer')

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

export const MAILER_ADAPTERS = Object.keys(FACTORY)

const INDEX_TS = (cfg) => `import { env } from '~/env'
${cfg.import}
import { createMailer } from './factory'
import type { MailAddress, Mailer } from './port'

export type EmailRecipient = MailAddress

let resolved: Mailer | null = null
function resolveMailer(): Mailer {
  if (!resolved) {
    resolved = createMailer({
      from: env.EMAIL_FROM,
      adapter: ${cfg.adapter},
    })
  }
  return resolved
}

export const mailer: Mailer = {
  send: (message) => resolveMailer().send(message),
}
`

export function currentMailerAdapter(projectDir) {
  const index = join(projectDir, EMAIL_DIR, 'index.ts')
  return exists(index) ? (read(index).match(/\.\/adapters\/([\w-]+)['"]/)?.[1] ?? null) : null
}

export function vendorMailer(projectDir, mailerSource, adapter, keep) {
  const cfg = FACTORY[adapter]
  if (!cfg)
    throw new Error(`Unknown mailer adapter: ${adapter} (have ${MAILER_ADAPTERS.join(', ')})`)
  const dir = join(projectDir, EMAIL_DIR)
  const previousProviders = MAILER_ADAPTERS.filter(
    (provider) => provider !== adapter && exists(join(dir, 'adapters', `${provider}.ts`)),
  )

  if (!exists(join(dir, 'index.ts'))) copy(mailerSource, dir)
  copy(
    adapter === 'resend'
      ? join(mailerSource, 'adapters/resend.ts')
      : join(MAILER_PKG, 'src/adapters', `${adapter}.ts`),
    join(dir, 'adapters', `${adapter}.ts`),
  )
  if (!keep)
    for (const a of MAILER_ADAPTERS) if (a !== adapter) remove(join(dir, 'adapters', `${a}.ts`))
  stripJsExtensions(join(dir, 'adapters'))
  write(join(dir, 'index.ts'), INDEX_TS(cfg))

  const mailerPkg = readJSON(join(MAILER_PKG, 'package.json'))
  const range = (d) => {
    const version = mailerPkg.dependencies?.[d] ?? mailerPkg.peerDependencies?.[d]
    if (!version) throw new Error(`Undeclared version for ${d} in the mailer package`)
    return version
  }
  const addDeps = Object.fromEntries([cfg.pkgDep, 'react-email'].map((d) => [d, range(d)]))
  const removeDeps = keep ? [] : previousProviders.map((provider) => FACTORY[provider].pkgDep)
  return { addDeps, removeDeps, envKeys: cfg.envKeys, requiredEnvKeys: cfg.requiredEnvKeys }
}
