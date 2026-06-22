import { createEnv } from '@t3-oss/env-core'
import * as v from 'valibot'

/** Required in production, optional in dev/test. */
export const requiredInProduction = <T extends v.GenericSchema>(schema: T) =>
  process.env.NODE_ENV === 'production' ? schema : v.optional(schema)

/**
 * Typed env. Foundations + capabilities extend `server` and `runtimeEnv` with
 * the keys they need.
 */
export const env = createEnv({
  shared: {
    NODE_ENV: v.optional(v.picklist(['development', 'test', 'production']), 'development'),
  },

  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    BETTER_AUTH_URL: v.pipe(v.string(), v.url()),
    BETTER_AUTH_SECRET: v.pipe(v.string(), v.minLength(1)),
    BETTER_AUTH_GOOGLE_CLIENT_ID: v.optional(v.pipe(v.string(), v.minLength(1))),
    BETTER_AUTH_GOOGLE_CLIENT_SECRET: v.optional(v.pipe(v.string(), v.minLength(1))),
    EMAIL_FROM: v.optional(v.pipe(v.string(), v.email()), 'no-reply@example.com'),
    RESEND_API_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_GOOGLE_CLIENT_ID: process.env.BETTER_AUTH_GOOGLE_CLIENT_ID,
    BETTER_AUTH_GOOGLE_CLIENT_SECRET: process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
