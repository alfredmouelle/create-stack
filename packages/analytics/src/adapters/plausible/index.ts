import { apiFetch } from '@alfredmouelle/http'
import * as v from 'valibot'
import type { AnalyticsPort, CaptureEvent } from '../../core/port.js'
import { PlausibleConfigSchema } from './config.js'

const DEFAULT_API_HOST = 'https://plausible.io'
const DEFAULT_USER_AGENT = '@alfredmouelle/analytics (+https://plausible.io)'

export interface PlausibleAdapterOptions {
  /** The site's domain as registered in Plausible (e.g. `acme.com`). */
  domain: string
  /** Plausible instance host. Defaults to `https://plausible.io`. */
  apiHost?: string
  /** Fallback page URL when an event carries no `url` property. */
  defaultUrl?: string
  /**
   * User-Agent sent to Plausible. Plausible derives the (cookieless) visitor id
   * from it plus the client IP, so set a realistic value for accurate counting.
   */
  userAgent?: string
  /** Inject a custom fetch (mock in tests, scoped client in adapters). */
  fetchImpl?: typeof globalThis.fetch
  /** Called when a fire-and-forget request fails. Defaults to swallowing. */
  onError?: (error: unknown) => void
}

interface PlausibleEventPayload {
  name: string
  domain: string
  url: string
  referrer?: string
  props?: Record<string, unknown>
}

/**
 * Plausible analytics adapter, backed by the server-side Events API
 * (`POST /api/event`). Like the port, `capture` is fire-and-forget: the request
 * is sent without blocking and tracked so `flush`/`shutdown` can drain it.
 *
 * Plausible is cookieless and stores no person profiles, so `identify` is a
 * no-op. The `distinctId` is forwarded as a `distinct_id` custom property for
 * visibility, but it does not drive Plausible's unique-visitor counting (that's
 * derived from the User-Agent + client IP).
 *
 * The page `url` and client `ip` are read from the event's `properties` (`url`,
 * `referrer`, `ip`); `url` falls back to `defaultUrl`.
 */
export function plausibleAdapter(options: PlausibleAdapterOptions): AnalyticsPort {
  const config = v.parse(PlausibleConfigSchema, {
    domain: options.domain,
    apiHost: options.apiHost,
  })
  const apiHost = config.apiHost ?? DEFAULT_API_HOST
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT
  const defaultUrl = options.defaultUrl ?? `https://${config.domain}/`
  const onError = options.onError ?? (() => {})
  const pending = new Set<Promise<void>>()

  function send(payload: PlausibleEventPayload, ip?: string): void {
    const headers: Record<string, string> = { 'User-Agent': userAgent }
    if (ip) headers['X-Forwarded-For'] = ip

    const request = apiFetch('/api/event', {
      method: 'POST',
      baseUrl: apiHost,
      headers,
      body: payload,
      parseAs: 'none',
      fetchImpl: options.fetchImpl,
    })
      .then(() => {})
      .catch(onError)

    pending.add(request)
    void request.finally(() => pending.delete(request))
  }

  return {
    name: 'plausible',
    capture(event: CaptureEvent) {
      const { url, referrer, ip, ...rest } = (event.properties ?? {}) as Record<string, unknown>
      send(
        {
          name: event.event,
          domain: config.domain,
          url: typeof url === 'string' ? url : defaultUrl,
          referrer: typeof referrer === 'string' ? referrer : undefined,
          props: { distinct_id: event.distinctId, ...rest },
        },
        typeof ip === 'string' ? ip : undefined,
      )
    },
    identify() {
      // Plausible is cookieless and stores no person profiles — nothing to do.
    },
    async flush() {
      await Promise.all([...pending])
    },
    async shutdown() {
      await Promise.all([...pending])
    },
  }
}
