import { apiFetch } from '@alfredmouelle/http'
import type { AnalyticsPort, CaptureEvent } from '../port.js'

const DEFAULT_API_HOST = 'https://plausible.io'
const DEFAULT_USER_AGENT = '@alfredmouelle/analytics (+https://plausible.io)'

export interface PlausibleAdapterOptions {
  /** Site domain as registered in Plausible (e.g. `acme.com`). */
  domain: string
  /** Plausible host. Defaults to `https://plausible.io`. */
  apiHost?: string
  /** Fallback page URL when an event has no `url`. */
  defaultUrl?: string
  /** User-Agent sent to Plausible; it derives the cookieless visitor id from UA + client IP, so use a realistic value. */
  userAgent?: string
  /** Inject a custom fetch (mock/scoped client). */
  fetchImpl?: typeof globalThis.fetch
  /** Called on fire-and-forget request failure; defaults to swallowing. */
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
 * Plausible adapter via server-side Events API (`POST /api/event`). `capture` is
 * fire-and-forget; requests are tracked so `flush`/`shutdown` drain them.
 * Cookieless, no person profiles, so `identify` is a no-op; `distinctId` is
 * forwarded as a `distinct_id` prop for visibility only (counting uses UA + IP).
 * `url`/`referrer`/`ip` read from event `properties`; `url` falls back to `defaultUrl`.
 */
export function plausibleAdapter(options: PlausibleAdapterOptions): AnalyticsPort {
  // Fail at construction, not on the first capture.
  if (!options.domain) throw new Error('plausibleAdapter: domain is required')
  const apiHost = options.apiHost ?? DEFAULT_API_HOST
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT
  const defaultUrl = options.defaultUrl ?? `https://${options.domain}/`
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
          domain: options.domain,
          url: typeof url === 'string' ? url : defaultUrl,
          referrer: typeof referrer === 'string' ? referrer : undefined,
          props: { distinct_id: event.distinctId, ...rest },
        },
        typeof ip === 'string' ? ip : undefined,
      )
    },
    identify() {
      // Cookieless, no person profiles — nothing to do.
    },
    async flush() {
      await Promise.all([...pending])
    },
    async shutdown() {
      await Promise.all([...pending])
    },
  }
}
