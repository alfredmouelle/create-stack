import { useEffect, useState } from 'react'
import {
  type AnalyticsConsent,
  disableAnalytics,
  enableAnalytics,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from '../lib/analytics'

export default function ConsentBanner() {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null)
  const [hasResolvedConsent, setHasResolvedConsent] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    const storedConsent = getAnalyticsConsent()
    setConsent(storedConsent)
    setHasResolvedConsent(true)
    if (storedConsent === 'accepted') void enableAnalytics()
  }, [])

  function choose(nextConsent: AnalyticsConsent) {
    setAnalyticsConsent(nextConsent)
    setConsent(nextConsent)
    setIsSettingsOpen(false)

    if (nextConsent === 'accepted') void enableAnalytics()
    else disableAnalytics()
  }

  if (!hasResolvedConsent) return null

  const isBannerVisible = consent === null || isSettingsOpen

  return (
    <>
      {isBannerVisible ? (
        <aside aria-labelledby="consent-title" className="consent" role="dialog">
          <h2 className="consent-title" id="consent-title">
            Analytics, on your terms.
          </h2>
          <p>
            Allow anonymous analytics (PostHog, EU)? Nothing loads until you choose.{' '}
            <a href="/privacy">Read the privacy page</a>
          </p>
          <div className="consent-actions">
            <button className="consent-choice" onClick={() => choose('rejected')} type="button">
              Decline
            </button>
            <button className="consent-choice" onClick={() => choose('accepted')} type="button">
              Accept
            </button>
          </div>
        </aside>
      ) : (
        <button
          aria-label="Open privacy settings"
          className="consent-trigger"
          onClick={() => setIsSettingsOpen(true)}
          type="button"
        >
          Privacy settings
        </button>
      )}
    </>
  )
}
