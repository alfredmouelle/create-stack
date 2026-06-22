// Rebuilds src/env.ts `server` + `runtimeEnv` blocks from the final key set,
// and generates .env.example + .env. Adds keys (e.g. a swapped mailer provider)
// and prunes keys of stripped foundations/capabilities — deterministically.

import { editFile, join, write } from './util.mjs'

/** valibot schema text per known env key. */
const SCHEMAS = {
  DATABASE_URL: 'v.pipe(v.string(), v.url())',
  BETTER_AUTH_URL: 'v.pipe(v.string(), v.url())',
  BETTER_AUTH_SECRET: 'v.pipe(v.string(), v.minLength(1))',
  BETTER_AUTH_GOOGLE_CLIENT_ID: 'v.optional(v.pipe(v.string(), v.minLength(1)))',
  BETTER_AUTH_GOOGLE_CLIENT_SECRET: 'v.optional(v.pipe(v.string(), v.minLength(1)))',
  EMAIL_FROM: "v.optional(v.pipe(v.string(), v.email()), 'no-reply@example.com')",
  RESEND_API_KEY: 'v.optional(v.pipe(v.string(), v.minLength(1)))',
  BREVO_API_KEY: 'v.optional(v.pipe(v.string(), v.minLength(1)))',
  AWS_REGION: 'v.optional(v.pipe(v.string(), v.minLength(1)))',
  AWS_ACCESS_KEY_ID: 'v.optional(v.pipe(v.string(), v.minLength(1)))',
  AWS_SECRET_ACCESS_KEY: 'v.optional(v.pipe(v.string(), v.minLength(1)))',
}

/** Placeholder values for the generated .env files. */
const PLACEHOLDERS = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/app',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'change-me-with-a-long-random-string',
  EMAIL_FROM: 'no-reply@example.com',
}

const indent = (s) => `    ${s}`

/** Write the final env.ts and .env files. `keys` is an ordered string[]. */
export function writeEnv(projectDir, keys) {
  const seen = new Set()
  const ordered = keys.filter((k) => SCHEMAS[k] && !seen.has(k) && seen.add(k))

  const serverBody = ordered.map((k) => indent(`${k}: ${SCHEMAS[k]},`)).join('\n')
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

  const lines = ordered.map((k) => `${k}=${PLACEHOLDERS[k] ?? ''}`)
  const body = `${lines.join('\n')}\n`
  write(join(projectDir, '.env.example'), body)
  write(join(projectDir, '.env'), body)
}
