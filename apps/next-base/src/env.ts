import { createEnv } from '@t3-oss/env-core'
import * as v from 'valibot'

/** Makes a var required only in production (optional in dev/test). */
export const requiredInProduction = <T extends v.GenericSchema>(schema: T) =>
  process.env.NODE_ENV === 'production' ? schema : v.optional(schema)

/**
 * Typed environment. Start minimal — patterns (drizzle, better-auth, …) and
 * capabilities (add-capability) extend the `server` block and `runtimeEnv` with
 * the keys they need.
 */
export const env = createEnv({
  shared: {
    NODE_ENV: v.optional(v.picklist(['development', 'test', 'production']), 'development'),
  },

  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    EMAIL_FROM: v.optional(v.pipe(v.string(), v.email()), 'no-reply@example.com'),
    RESEND_API_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
