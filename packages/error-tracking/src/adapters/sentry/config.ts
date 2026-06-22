import * as v from 'valibot'

export const SentryConfigSchema = v.object({
  dsn: v.pipe(v.string(), v.minLength(1, 'SENTRY_DSN is required')),
  environment: v.optional(v.string()),
})

export type SentryConfig = v.InferOutput<typeof SentryConfigSchema>
