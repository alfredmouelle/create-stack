import {
  type AnalyticsPort,
  noopAdapter as analyticsNoopAdapter,
  posthogAdapter,
} from '@alfredmouelle/analytics'
import { type CachePort, memoryAdapter as cacheMemoryAdapter, redisAdapter } from '@alfredmouelle/cache'
import {
  consoleAdapter as consoleErrorTracking,
  type ErrorTrackingPort,
  sentryAdapter,
} from '@alfredmouelle/error-tracking'
import {
  type InngestJobsAdapter,
  inngestAdapter,
  type JobsPort,
  memoryAdapter as jobsMemoryAdapter,
} from '@alfredmouelle/jobs'
import { consoleAdapter as consoleLogger, type Logger, pinoAdapter } from '@alfredmouelle/logger'
import { brevoAdapter, createMailer, type Mailer, resendAdapter } from '@alfredmouelle/mailer'
import { gcsAdapter, localAdapter, r2Adapter, type StoragePort, s3Adapter } from '@alfredmouelle/storage'
import { env } from '../env.js'

/** Fail fast with a readable message when a selected provider misses a key. */
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required for the selected provider`)
  return value
}

export const logger: Logger =
  env.LOGGER_PROVIDER === 'pino'
    ? pinoAdapter({ level: env.LOG_LEVEL })
    : consoleLogger({ level: env.LOG_LEVEL })

export const errorTracking: ErrorTrackingPort =
  env.ERROR_TRACKING_PROVIDER === 'sentry'
    ? sentryAdapter({
        dsn: required(env.SENTRY_DSN, 'SENTRY_DSN'),
        environment: env.SENTRY_ENVIRONMENT,
      })
    : consoleErrorTracking()

export const cache: CachePort =
  env.CACHE_PROVIDER === 'redis'
    ? redisAdapter({ url: required(env.REDIS_URL, 'REDIS_URL') })
    : cacheMemoryAdapter()

export const analytics: AnalyticsPort =
  env.ANALYTICS_PROVIDER === 'posthog'
    ? posthogAdapter({
        apiKey: required(env.POSTHOG_API_KEY, 'POSTHOG_API_KEY'),
        host: env.POSTHOG_HOST,
      })
    : analyticsNoopAdapter()

export const storage: StoragePort = (() => {
  switch (env.STORAGE_PROVIDER) {
    case 's3':
      return s3Adapter({
        bucket: required(env.S3_BUCKET, 'S3_BUCKET'),
        region: required(env.S3_REGION, 'S3_REGION'),
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        endpoint: env.S3_ENDPOINT,
      })
    case 'r2':
      return r2Adapter({
        bucket: required(env.R2_BUCKET, 'R2_BUCKET'),
        accountId: required(env.R2_ACCOUNT_ID, 'R2_ACCOUNT_ID'),
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      })
    case 'gcs':
      return gcsAdapter({
        bucket: required(env.GCS_BUCKET, 'GCS_BUCKET'),
        projectId: env.GOOGLE_CLOUD_PROJECT,
      })
    default:
      return localAdapter({ baseDir: env.STORAGE_LOCAL_DIR, publicBaseUrl: env.STORAGE_PUBLIC_URL })
  }
})()

export const mailer: Mailer = createMailer({
  from: env.EMAIL_FROM,
  adapter:
    env.EMAIL_PROVIDER === 'brevo'
      ? brevoAdapter({ apiKey: required(env.BREVO_API_KEY, 'BREVO_API_KEY') })
      : resendAdapter({ apiKey: required(env.RESEND_API_KEY, 'RESEND_API_KEY') }),
})

/**
 * The concrete Inngest adapter when `JOBS_PROVIDER=inngest` (exposes `.functions`
 * and `.client` for `serve`), otherwise `null`. The route at
 * `src/routes/api/inngest.ts` uses it to mount the endpoint.
 */
export const inngestJobs: InngestJobsAdapter | null =
  env.JOBS_PROVIDER === 'inngest'
    ? inngestAdapter({
        id: 'with-tanstack',
        eventKey: env.INNGEST_EVENT_KEY,
      })
    : null

/** The jobs port used everywhere to `trigger` events and `defineJob`. */
export const jobs: JobsPort = inngestJobs ?? jobsMemoryAdapter()
