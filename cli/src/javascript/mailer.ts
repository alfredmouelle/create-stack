import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripJsExtensions } from '#lib/capabilities.ts'
import { STACK_ROOT, TEMPLATES } from '#lib/paths.ts'
import { copy, exists, read, remove, write } from '#lib/util.ts'
import type { Mailer } from '../../../packages/stack-config/src/index.ts'
import { isJsonObject, readJsonObject } from './json.ts'

export type MailerProvider = Exclude<Mailer, 'none'>

type MailerProviderWiring = {
  readonly adapter: string
  readonly envKeys: readonly string[]
  readonly requiredEnvKeys: readonly string[]
  readonly dependency: string
}

export type MailerVendoring = {
  readonly addDeps: Readonly<Record<string, string>>
  readonly removeDeps: readonly string[]
  readonly envKeys: readonly string[]
  readonly requiredEnvKeys: readonly string[]
}

const EMAIL_DIR = 'src/server/email'
const MAILER_PACKAGE = join(STACK_ROOT, 'packages/mailer')

export const MAILER_PROVIDERS: Readonly<Record<MailerProvider, MailerProviderWiring>> = {
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

export const MAILER_ADAPTERS: readonly MailerProvider[] = ['resend', 'brevo', 'ses']

const isMailerProvider = (value: string | null): value is MailerProvider =>
  MAILER_ADAPTERS.some((provider) => provider === value)

export const renderMailerIndex = (provider: MailerProvider): string =>
  readFileSync(join(TEMPLATES, 'javascript/mailer.txt'), 'utf8')
    .replace('__ADAPTER_IMPORT__', `import { ${provider}Adapter } from './adapters/${provider}'`)
    .replace('__ADAPTER__', MAILER_PROVIDERS[provider].adapter)

export function currentMailerAdapter(projectDir: string): string | null {
  const index = join(projectDir, EMAIL_DIR, 'index.ts')
  return exists(index) ? (read(index).match(/\.\/adapters\/([\w-]+)['"]/)?.[1] ?? null) : null
}

function mailerPackageVersion(name: string): string {
  const manifest = readJsonObject(join(MAILER_PACKAGE, 'package.json'))
  const declared = [manifest.dependencies, manifest.peerDependencies].map((field) =>
    isJsonObject(field) ? field[name] : undefined,
  )
  const version = declared.find((value) => typeof value === 'string')
  if (typeof version !== 'string')
    throw new Error(`Undeclared version for ${name} in the mailer package`)
  return version
}

export function vendorMailer(
  projectDir: string,
  mailerSource: string,
  adapter: string | null,
  keep: boolean,
): MailerVendoring {
  if (!isMailerProvider(adapter))
    throw new Error(`Unknown mailer adapter: ${adapter} (have ${MAILER_ADAPTERS.join(', ')})`)
  const wiring = MAILER_PROVIDERS[adapter]
  const dir = join(projectDir, EMAIL_DIR)
  const others = MAILER_ADAPTERS.filter((provider) => provider !== adapter)
  const previousProviders = others.filter((provider) =>
    exists(join(dir, 'adapters', `${provider}.ts`)),
  )

  if (!exists(join(dir, 'index.ts'))) copy(mailerSource, dir)
  copy(
    adapter === 'resend'
      ? join(mailerSource, 'adapters/resend.ts')
      : join(MAILER_PACKAGE, 'src/adapters', `${adapter}.ts`),
    join(dir, 'adapters', `${adapter}.ts`),
  )
  if (!keep) for (const provider of others) remove(join(dir, 'adapters', `${provider}.ts`))
  stripJsExtensions(join(dir, 'adapters'))
  write(join(dir, 'index.ts'), renderMailerIndex(adapter))

  return {
    addDeps: Object.fromEntries(
      [wiring.dependency, 'react-email'].map((name) => [name, mailerPackageVersion(name)]),
    ),
    removeDeps: keep
      ? []
      : previousProviders.map((provider) => MAILER_PROVIDERS[provider].dependency),
    envKeys: ['EMAIL_FROM', ...wiring.envKeys],
    requiredEnvKeys: wiring.requiredEnvKeys,
  }
}
