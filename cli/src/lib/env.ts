import { editFile, exists, join, read, write } from './util.ts'

type EnvField = { readonly key: string; readonly schema: string }

const SCHEMAS: Readonly<Record<string, string>> = {
  DATABASE_URL: 'v.pipe(v.string(), v.url())',
  BETTER_AUTH_URL: 'v.pipe(v.string(), v.url())',
  BETTER_AUTH_SECRET: 'v.pipe(v.string(), v.minLength(1))',
  BETTER_AUTH_GOOGLE_CLIENT_ID: 'v.pipe(v.string(), v.minLength(1))',
  BETTER_AUTH_GOOGLE_CLIENT_SECRET: 'v.pipe(v.string(), v.minLength(1))',
  EMAIL_FROM: 'v.pipe(v.string(), v.email())',
  RESEND_API_KEY: 'v.pipe(v.string(), v.minLength(1))',
  BREVO_API_KEY: 'v.pipe(v.string(), v.minLength(1))',
  AWS_REGION: 'v.pipe(v.string(), v.minLength(1))',
  AWS_ACCESS_KEY_ID: 'v.pipe(v.string(), v.minLength(1))',
  AWS_SECRET_ACCESS_KEY: 'v.pipe(v.string(), v.minLength(1))',
  S3_BUCKET: 'v.pipe(v.string(), v.minLength(1))',
  S3_REGION: 'v.pipe(v.string(), v.minLength(1))',
  R2_BUCKET: 'v.pipe(v.string(), v.minLength(1))',
  R2_ACCOUNT_ID: 'v.pipe(v.string(), v.minLength(1))',
  R2_JURISDICTION: "v.picklist(['eu', 'fedramp'])",
  R2_ACCESS_KEY_ID: 'v.pipe(v.string(), v.minLength(1))',
  R2_SECRET_ACCESS_KEY: 'v.pipe(v.string(), v.minLength(1))',
  GCS_BUCKET: 'v.pipe(v.string(), v.minLength(1))',
  GOOGLE_CLOUD_PROJECT: 'v.pipe(v.string(), v.minLength(1))',
  STORAGE_LOCAL_DIR: 'v.pipe(v.string(), v.minLength(1))',
  REDIS_URL: 'v.pipe(v.string(), v.url())',
  UPSTASH_REDIS_REST_URL: 'v.pipe(v.string(), v.url())',
  UPSTASH_REDIS_REST_TOKEN: 'v.pipe(v.string(), v.minLength(1))',
  POSTHOG_API_KEY: 'v.pipe(v.string(), v.minLength(1))',
  POSTHOG_HOST: 'v.pipe(v.string(), v.url())',
  PLAUSIBLE_DOMAIN: 'v.pipe(v.string(), v.minLength(1))',
  PLAUSIBLE_API_HOST: 'v.pipe(v.string(), v.url())',
  SENTRY_DSN: 'v.pipe(v.string(), v.minLength(1))',
  SENTRY_ENVIRONMENT: 'v.pipe(v.string(), v.minLength(1))',
  INNGEST_EVENT_KEY: 'v.pipe(v.string(), v.minLength(1))',
  INNGEST_SIGNING_KEY: 'v.pipe(v.string(), v.minLength(1))',
  TRIGGER_SECRET_KEY: 'v.pipe(v.string(), v.minLength(1))',
}

const DEFAULTS: Readonly<Record<string, string>> = {
  EMAIL_FROM: "'no-reply@example.com'",
}

const PLACEHOLDERS: Readonly<Record<string, string>> = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/app',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'change-me-with-a-long-random-string',
  EMAIL_FROM: 'no-reply@example.com',
  RESEND_API_KEY: 're_change_me',
  BREVO_API_KEY: 'change-me',
  S3_BUCKET: 'my-bucket',
  S3_REGION: 'us-east-1',
  R2_BUCKET: 'my-bucket',
  R2_ACCOUNT_ID: 'change-me',
  GCS_BUCKET: 'my-bucket',
  STORAGE_LOCAL_DIR: '.data/storage',
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'change-me',
  POSTHOG_API_KEY: 'phc_change_me',
  PLAUSIBLE_DOMAIN: 'example.com',
}

const indent = (s: string): string => `    ${s}`

const knownFields = (keys: readonly string[]): EnvField[] =>
  keys.flatMap((key) => {
    const schema = SCHEMAS[key]
    return schema ? [{ key, schema }] : []
  })

const renderSchema = ({ key, schema }: EnvField, required: boolean): string => {
  if (required) return schema
  const def = DEFAULTS[key]
  return def ? `v.optional(${schema}, ${def})` : `v.optional(${schema})`
}

function environmentFields(keys: readonly string[], requiredKeys: readonly string[]) {
  const required = new Set(requiredKeys)
  const seen = new Set<string>()
  const fields = knownFields(keys).filter(({ key }) => !seen.has(key) && seen.add(key))
  const ordered = fields.map(({ key }) => key)

  const serverBody = fields
    .map((field) => indent(`${field.key}: ${renderSchema(field, required.has(field.key))},`))
    .join('\n')
  const runtimeBody = [
    indent('NODE_ENV: process.env.NODE_ENV,'),
    ...ordered.map((k) => indent(`${k}: process.env.${k},`)),
  ].join('\n')

  return { required, ordered, serverBody, runtimeBody }
}

export function renderEnvironment(
  keys: readonly string[],
  requiredKeys: readonly string[] = [],
): string {
  const { serverBody, runtimeBody } = environmentFields(keys, requiredKeys)
  return `import { createEnv } from '@t3-oss/env-core'
import * as v from 'valibot'

export const requiredInProduction = <T extends v.GenericSchema>(schema: T) =>
  process.env.NODE_ENV === 'production' ? schema : v.optional(schema)

export const env = createEnv({
  shared: {
    NODE_ENV: v.optional(v.picklist(['development', 'test', 'production']), 'development'),
  },

${serverBody ? `  server: {\n${serverBody}\n  },` : '  server: {},'}

  runtimeEnv: {
${runtimeBody}
  },

  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true,
})
`
}

export function writeEnv(
  projectDir: string,
  keys: readonly string[],
  requiredKeys: readonly string[] = [],
  localValues: Readonly<Record<string, string>> = {},
  testValues: Readonly<Record<string, string>> | null = null,
): void {
  const { required, ordered } = environmentFields(keys, requiredKeys)
  write(join(projectDir, 'src/env.ts'), renderEnvironment(keys, requiredKeys))

  const placeholder = (k: string): string => PLACEHOLDERS[k] ?? (required.has(k) ? 'changeme' : '')
  const render = (pick: (key: string) => string): string =>
    `${ordered.map((k) => `${k}=${pick(k)}`).join('\n')}\n`
  write(join(projectDir, '.env.example'), render(placeholder))
  write(
    join(projectDir, '.env'),
    render((k) => localValues[k] ?? placeholder(k)),
  )
  if (testValues) {
    write(
      join(projectDir, '.env.test'),
      render((k) => testValues[k] ?? placeholder(k)),
    )
  }
}

export function appendRawEnvLines(projectDir: string, lines: readonly string[]): void {
  for (const file of ['.env.example', '.env', '.env.test']) {
    const path = join(projectDir, file)
    if (!exists(path)) continue
    const cur = read(path)
    const have = new Set(cur.split('\n').map((l) => l.split('=')[0]))
    const add = lines.filter((l) => !have.has(l.split('=')[0]))
    if (!add.length) continue
    write(path, `${cur.replace(/\n*$/, '')}\n${add.join('\n')}\n`)
  }
}

const envLine = (k: string, required: boolean): string =>
  `${k}=${PLACEHOLDERS[k] ?? (required ? 'changeme' : '')}`

export function appendEnv(
  projectDir: string,
  keys: readonly string[],
  requiredKeys: readonly string[] = [],
): void {
  const required = new Set(requiredKeys)
  const known = knownFields(keys)

  editFile(join(projectDir, 'src/env.ts'), (src) => {
    const add = known.filter(({ key }) => !new RegExp(`\\n {4}${key}:`).test(src))
    if (!add.length) return src
    const serverLines = add
      .map((field) => indent(`${field.key}: ${renderSchema(field, required.has(field.key))},`))
      .join('\n')
    const runtimeLines = add.map(({ key }) => indent(`${key}: process.env.${key},`)).join('\n')
    return src
      .replace('  server: {},', '  server: {\n  },')
      .replace(/( {2}server: \{[\s\S]*?)(\n {2}\},)/, `$1\n${serverLines}$2`)
      .replace(/( {2}runtimeEnv: \{[\s\S]*?)(\n {2}\},)/, `$1\n${runtimeLines}$2`)
  })

  for (const file of ['.env.example', '.env', '.env.test']) {
    const path = join(projectDir, file)
    if (!exists(path)) continue
    const cur = read(path)
    const have = new Set(cur.split('\n').map((l) => l.split('=')[0]))
    const add = known.filter(({ key }) => !have.has(key)).map(({ key }) => key)
    if (!add.length) continue
    write(
      path,
      `${cur.replace(/\n*$/, '')}\n${add.map((k) => envLine(k, required.has(k))).join('\n')}\n`,
    )
  }
}
