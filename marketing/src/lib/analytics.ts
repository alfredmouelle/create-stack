import type { StackConfiguration } from '@alfredmouelle/stack-config'
import type { CaptureResult } from 'posthog-js'
import type { BuildState, PackageManager } from './build-config'

export const ANALYTICS_CONSENT_STORAGE_KEY = 'create-stack.analytics-consent'
export const ANALYTICS_PRODUCTION_HOSTNAME = 'create-stack.alfredmouelle.com'

const ANALYTICS_CONSENT_VERSION = 'v1'
const POSTHOG_API_HOST = 'https://eu.i.posthog.com'
const POSTHOG_PERSISTENCE_NAME = 'create-stack-posthog'
const POSTHOG_PROJECT_KEY = 'phc_AEMsXVZV6mDPZ32awWWzYYLjLwcxHs56G2GDmfdNkQgb'

export type AnalyticsConsent = 'accepted' | 'rejected'
export type CommandCopiedSource = 'hero' | 'wizard'

type PostHogClient = typeof import('posthog-js').default

let postHogPromise: Promise<PostHogClient> | null = null
let analyticsDisabled = false

export function isProductionOrigin(location?: Pick<Location, 'hostname'>): boolean {
  if (location) return location.hostname === ANALYTICS_PRODUCTION_HOSTNAME
  return typeof window !== 'undefined' && window.location.hostname === ANALYTICS_PRODUCTION_HOSTNAME
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null

  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)
    if (value === `${ANALYTICS_CONSENT_VERSION}:accepted`) return 'accepted'
    if (value === `${ANALYTICS_CONSENT_VERSION}:rejected`) return 'rejected'
  } catch {
    return null
  }

  return null
}

export function setAnalyticsConsent(consent: AnalyticsConsent): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      `${ANALYTICS_CONSENT_VERSION}:${consent}`,
    )
  } catch {
    // A blocked storage API should not prevent the site from working.
  }
}

function clearPostHogPersistence(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(POSTHOG_PERSISTENCE_NAME)
    window.localStorage.removeItem(`ph_${POSTHOG_PERSISTENCE_NAME}`)
    window.localStorage.removeItem('ph_optout')
  } catch {
    // A blocked storage API should not prevent consent withdrawal.
  }

  if (typeof document !== 'undefined') {
    for (const name of [POSTHOG_PERSISTENCE_NAME, `ph_${POSTHOG_PERSISTENCE_NAME}`, 'ph_optout']) {
      // biome-ignore lint/suspicious/noDocumentCookie: clear the browser persistence used by older PostHog sessions
      document.cookie = `${name}=; Max-Age=0; path=/`
    }
  }
}

function sanitizeEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event || !isProductionOrigin()) return null

  if (event.properties) {
    const properties = { ...event.properties }
    delete properties.$current_url
    delete properties.$host
    delete properties.$initial_referrer
    delete properties.$initial_referring_domain
    delete properties.$pathname
    delete properties.$referrer
    delete properties.$referring_domain
    properties.$current_url = `${window.location.origin}${window.location.pathname}`
    properties.$pathname = window.location.pathname
    event.properties = properties
  }

  return event
}

async function getPostHog(): Promise<PostHogClient> {
  if (!postHogPromise) {
    postHogPromise = import('posthog-js').then(({ default: posthog }) => {
      posthog.init(POSTHOG_PROJECT_KEY, {
        api_host: POSTHOG_API_HOST,
        autocapture: false,
        capture_pageleave: true,
        capture_pageview: 'history_change',
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_heatmaps: false,
        capture_performance: false,
        defaults: '2026-05-30',
        disable_external_dependency_loading: true,
        disable_product_tours: true,
        disable_session_recording: true,
        disable_surveys: true,
        disable_web_experiments: true,
        enable_recording_console_log: false,
        advanced_disable_decide: true,
        advanced_disable_feature_flags: true,
        rageclick: false,
        ip: false,
        persistence_name: POSTHOG_PERSISTENCE_NAME,
        person_profiles: 'identified_only',
        respect_dnt: true,
        save_campaign_params: false,
        before_send: sanitizeEvent,
      })
      return posthog
    })
  }

  return postHogPromise
}

export async function enableAnalytics(): Promise<void> {
  analyticsDisabled = false
  if (!isProductionOrigin() || getAnalyticsConsent() !== 'accepted') return

  const posthog = await getPostHog()
  if (analyticsDisabled) {
    posthog.opt_out_capturing()
    return
  }

  if (posthog.has_opted_out_capturing()) {
    posthog.opt_in_capturing({ captureEventName: false })
  }
}

export function disableAnalytics(): void {
  analyticsDisabled = true
  clearPostHogPersistence()

  if (postHogPromise) {
    void postHogPromise.then((posthog) => {
      posthog.opt_out_capturing()
      posthog.reset()
      clearPostHogPersistence()
    })
  }
}

export function commandCopiedProperties({
  source,
  packageManager,
  state,
  configuration,
}: {
  source: CommandCopiedSource
  packageManager: PackageManager
  state: BuildState
  configuration: StackConfiguration
}): Record<string, unknown> {
  const capabilities = Object.entries(state.capabilities)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, provider]) => `${name}:${provider}`)

  return {
    source,
    pm: packageManager,
    framework: configuration.framework,
    monorepo: state.monorepo ?? 'single-app',
    database: configuration.database,
    auth: configuration.auth,
    trpc: configuration.trpc,
    mailer: configuration.mailer,
    capabilities,
    stack: [
      configuration.framework,
      state.monorepo ?? 'single-app',
      configuration.database,
      configuration.auth,
      `trpc:${configuration.trpc ? 'on' : 'off'}`,
      configuration.mailer,
      ...capabilities,
    ].join(' · '),
  }
}

export function captureMarketingEvent(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  if (!isProductionOrigin() || getAnalyticsConsent() !== 'accepted') return

  void getPostHog().then((posthog) => {
    if (!analyticsDisabled && !posthog.has_opted_out_capturing()) {
      posthog.capture(event, properties)
    }
  })
}

export function captureCommandCopied(input: {
  source: CommandCopiedSource
  packageManager: PackageManager
  state?: BuildState
  configuration?: StackConfiguration
}): void {
  const properties =
    input.state && input.configuration
      ? commandCopiedProperties({
          configuration: input.configuration,
          packageManager: input.packageManager,
          source: input.source,
          state: input.state,
        })
      : { pm: input.packageManager, source: input.source }
  captureMarketingEvent('command_copied', properties)
}

export function captureShareLinkCopied(): void {
  captureMarketingEvent('share_link_copied', { source: 'wizard' })
}
