import { createEnv } from '@t3-oss/env-core'
import * as v from 'valibot'

const optionalString = v.optional(v.pipe(v.string(), v.minLength(1)))

/**
 * Typed environment. Each capability is selected by a `*_PROVIDER` variable and
 * reads only the keys its chosen adapter needs. Identical to the TanStack app —
 * env selection is framework-agnostic.
 */
export const env = createEnv({
  shared: {
    NODE_ENV: v.optional(v.picklist(['development', 'test', 'production']), 'development'),
  },
  server: {
    EMAIL_PROVIDER: v.optional(v.picklist(['resend', 'brevo']), 'resend'),
    EMAIL_FROM: v.optional(v.pipe(v.string(), v.email()), 'no-reply@example.com'),
    RESEND_API_KEY: optionalString,
    BREVO_API_KEY: optionalString,

    STORAGE_PROVIDER: v.optional(v.picklist(['s3', 'r2', 'gcs', 'local']), 'local'),
    S3_BUCKET: optionalString,
    S3_REGION: optionalString,
    S3_ENDPOINT: v.optional(v.pipe(v.string(), v.url())),
    AWS_ACCESS_KEY_ID: optionalString,
    AWS_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET: optionalString,
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    GCS_BUCKET: optionalString,
    GOOGLE_CLOUD_PROJECT: optionalString,
    STORAGE_LOCAL_DIR: v.optional(v.string(), '.storage'),
    STORAGE_PUBLIC_URL: v.optional(v.pipe(v.string(), v.url()), 'http://localhost:3000/files'),

    JOBS_PROVIDER: v.optional(v.picklist(['inngest', 'memory']), 'memory'),
    INNGEST_EVENT_KEY: optionalString,
    INNGEST_SIGNING_KEY: optionalString,

    LOGGER_PROVIDER: v.optional(v.picklist(['pino', 'console']), 'console'),
    LOG_LEVEL: v.optional(v.picklist(['trace', 'debug', 'info', 'warn', 'error']), 'info'),

    CACHE_PROVIDER: v.optional(v.picklist(['redis', 'memory']), 'memory'),
    REDIS_URL: v.optional(v.pipe(v.string(), v.url())),

    ANALYTICS_PROVIDER: v.optional(v.picklist(['posthog', 'noop']), 'noop'),
    POSTHOG_API_KEY: optionalString,
    POSTHOG_HOST: v.optional(v.pipe(v.string(), v.url())),

    ERROR_TRACKING_PROVIDER: v.optional(v.picklist(['sentry', 'console']), 'console'),
    SENTRY_DSN: optionalString,
    SENTRY_ENVIRONMENT: optionalString,
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
