import { stripJsExtensions } from './capabilities.mjs'
import { STACK_ROOT, TEMPLATES } from './paths.mjs'
import { copy, exists, join, read, readJSON, remove, write } from './util.mjs'

const EMAIL_DIR = 'src/server/email'
const MAILER_PKG = join(STACK_ROOT, 'packages/mailer')

export const MAILER_PROVIDERS = {
  resend: {
    adapter: 'resendAdapter({ apiKey: env.RESEND_API_KEY })',
    envKeys: ['RESEND_API_KEY'],
    requiredEnvKeys: ['RESEND_API_KEY'],
    dependency: 'resend',
  },
  brevo: {
    adapter: 'brevoAdapter({ apiKey: env.BREVO_API_KEY })',
    envKeys: ['BREVO_API_KEY'],
    requiredEnvKeys: ['BREVO_API_KEY'],
    dependency: '@getbrevo/brevo',
  },
  ses: {
    adapter: 'sesAdapter()',
    envKeys: ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    requiredEnvKeys: [],
    dependency: '@aws-sdk/client-sesv2',
  },
}

export const MAILER_ADAPTERS = Object.keys(MAILER_PROVIDERS)

export const renderMailerIndex = (provider) =>
  read(join(TEMPLATES, 'javascript/mailer.txt'))
    .replace('__ADAPTER_IMPORT__', `import { ${provider}Adapter } from './adapters/${provider}'`)
    .replace('__ADAPTER__', MAILER_PROVIDERS[provider].adapter)

export function currentMailerAdapter(projectDir) {
  const index = join(projectDir, EMAIL_DIR, 'index.ts')
  return exists(index) ? (read(index).match(/\.\/adapters\/([\w-]+)['"]/)?.[1] ?? null) : null
}

export function vendorMailer(projectDir, mailerSource, adapter, keep) {
  const cfg = MAILER_PROVIDERS[adapter]
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
  write(join(dir, 'index.ts'), renderMailerIndex(adapter))

  const mailerPkg = readJSON(join(MAILER_PKG, 'package.json'))
  const range = (d) => {
    const version = mailerPkg.dependencies?.[d] ?? mailerPkg.peerDependencies?.[d]
    if (!version) throw new Error(`Undeclared version for ${d} in the mailer package`)
    return version
  }
  const addDeps = Object.fromEntries([cfg.dependency, 'react-email'].map((d) => [d, range(d)]))
  const removeDeps = keep
    ? []
    : previousProviders.map((provider) => MAILER_PROVIDERS[provider].dependency)
  return {
    addDeps,
    removeDeps,
    envKeys: ['EMAIL_FROM', ...cfg.envKeys],
    requiredEnvKeys: cfg.requiredEnvKeys,
  }
}
