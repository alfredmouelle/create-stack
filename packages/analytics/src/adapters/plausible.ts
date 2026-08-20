import { apiFetch } from '@alfredmouelle/http'
import type { AnalyticsPort, CaptureEvent } from '../port.js'

const DEFAULT_API_HOST = 'https://plausible.io'
const DEFAULT_USER_AGENT = '@alfredmouelle/analytics (+https://plausible.io)'

export interface PlausibleAdapterOptions {
  domain: string
  apiHost?: string
  defaultUrl?: string
  userAgent?: string
  fetchImpl?: typeof globalThis.fetch
  onError?: (error: unknown) => void
}

interface PlausibleEventPayload {
  name: string
  domain: string
  url: string
  referrer?: string
  props?: Record<string, unknown>
}

export function plausibleAdapter(options: PlausibleAdapterOptions): AnalyticsPort {
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
    identify() {},
    async flush() {
      await Promise.all([...pending])
    },
    async shutdown() {
      await Promise.all([...pending])
    },
  }
}
