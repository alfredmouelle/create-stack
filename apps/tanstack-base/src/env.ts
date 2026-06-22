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
    // Extended by patterns/capabilities (DATABASE_URL, BETTER_AUTH_SECRET, …).
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
  },

  emptyStringAsUndefined: true,
})
