// Rebuilds src/env.ts `server` + `runtimeEnv` from the final key set; generates
// .env.example + .env, deterministically. Required keys (the provider/adapter keys a
// composition root reads via env.X) are emitted without v.optional — so env.X is a
// guaranteed string — and always carry a non-empty placeholder, so it boots/builds.

import { editFile, exists, join, read, write } from './util.mjs'

/** Inner valibot validator per env key (the optional wrapper is added per call). */
const SCHEMAS = {
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

/** Fallback values for optional keys, rendered as v.optional(schema, default). */
const DEFAULTS = {
  EMAIL_FROM: "'no-reply@example.com'",
}

/** Placeholder values for generated .env files; required keys fall back to a marker. */
const PLACEHOLDERS = {
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
  SENTRY_DSN: 'https://change-me@o0.ingest.sentry.io/0',
}

const indent = (s) => `    ${s}`

/** Valibot schema text for a key — required keys skip the v.optional wrapper. */
const renderSchema = (key, required) => {
  const inner = SCHEMAS[key]
  if (required) return inner
  const def = DEFAULTS[key]
  return def ? `v.optional(${inner}, ${def})` : `v.optional(${inner})`
}

/**
 * Write final env.ts + .env files.
 * @param {string} projectDir
 * @param {string[]} keys           ordered env keys to emit
 * @param {string[]} [requiredKeys] keys emitted without v.optional (+ guaranteed placeholder)
 */
export function writeEnv(projectDir, keys, requiredKeys = []) {
  const required = new Set(requiredKeys)
  const seen = new Set()
  const ordered = keys.filter((k) => SCHEMAS[k] && !seen.has(k) && seen.add(k))

  const serverBody = ordered
    .map((k) => indent(`${k}: ${renderSchema(k, required.has(k))},`))
    .join('\n')
  const runtimeBody = [
    indent('NODE_ENV: process.env.NODE_ENV,'),
    ...ordered.map((k) => indent(`${k}: process.env.${k},`)),
  ].join('\n')

  editFile(join(projectDir, 'src/env.ts'), (src) => {
    let out = src.replace(/ {2}server: \{[\s\S]*?\n {2}\},/, `  server: {\n${serverBody}\n  },`)
    out = out.replace(
      / {2}runtimeEnv: \{[\s\S]*?\n {2}\},/,
      `  runtimeEnv: {\n${runtimeBody}\n  },`,
    )
    return out
  })

  // A required key with a blank value becomes undefined (emptyStringAsUndefined) and
  // fails env validation at boot — so required keys always get a non-empty placeholder.
  const lines = ordered.map((k) => `${k}=${PLACEHOLDERS[k] ?? (required.has(k) ? 'changeme' : '')}`)
  const body = `${lines.join('\n')}\n`
  write(join(projectDir, '.env.example'), body)
  write(join(projectDir, '.env'), body)
}

/** Append literal `KEY=value` lines to the generated .env files (for keys read outside env.ts). */
export function appendRawEnvLines(projectDir, lines) {
  for (const file of ['.env.example', '.env']) {
    const path = join(projectDir, file)
    if (!exists(path)) continue
    const cur = read(path)
    const have = new Set(cur.split('\n').map((l) => l.split('=')[0]))
    const add = lines.filter((l) => !have.has(l.split('=')[0]))
    if (!add.length) continue
    write(path, `${cur.replace(/\n*$/, '')}\n${add.join('\n')}\n`)
  }
}

const envLine = (k, required) => `${k}=${PLACEHOLDERS[k] ?? (required ? 'changeme' : '')}`

/** Append new keys into the generated env.ts server/runtimeEnv blocks + .env files, leaving existing keys intact. */
export function appendEnv(projectDir, keys, requiredKeys = []) {
  const required = new Set(requiredKeys)
  const known = keys.filter((k) => SCHEMAS[k])

  editFile(join(projectDir, 'src/env.ts'), (src) => {
    const add = known.filter((k) => !new RegExp(`\\n {4}${k}:`).test(src))
    if (!add.length) return src
    const serverLines = add
      .map((k) => indent(`${k}: ${renderSchema(k, required.has(k))},`))
      .join('\n')
    const runtimeLines = add.map((k) => indent(`${k}: process.env.${k},`)).join('\n')
    return src
      .replace(/( {2}server: \{[\s\S]*?)(\n {2}\},)/, `$1\n${serverLines}$2`)
      .replace(/( {2}runtimeEnv: \{[\s\S]*?)(\n {2}\},)/, `$1\n${runtimeLines}$2`)
  })

  for (const file of ['.env.example', '.env']) {
    const path = join(projectDir, file)
    if (!exists(path)) continue
    const cur = read(path)
    const have = new Set(cur.split('\n').map((l) => l.split('=')[0]))
    const add = known.filter((k) => !have.has(k))
    if (!add.length) continue
    write(
      path,
      `${cur.replace(/\n*$/, '')}\n${add.map((k) => envLine(k, required.has(k))).join('\n')}\n`,
    )
  }
}
