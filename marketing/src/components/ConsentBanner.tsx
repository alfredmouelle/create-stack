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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    const storedConsent = getAnalyticsConsent()
    setConsent(storedConsent)
    if (storedConsent === 'accepted') void enableAnalytics()
  }, [])

  function choose(nextConsent: AnalyticsConsent) {
    setAnalyticsConsent(nextConsent)
    setConsent(nextConsent)
    setIsSettingsOpen(false)

    if (nextConsent === 'accepted') void enableAnalytics()
    else disableAnalytics()
  }

  const isBannerVisible = consent === null || isSettingsOpen

  return (
    <>
      {isBannerVisible ? (
        <aside aria-labelledby="consent-title" className="consent-banner" role="dialog">
          <div className="consent-label">
            <span aria-hidden="true" className="terminal-window">
              <i />
              <i />
              <i />
            </span>
            <span>create-stack / privacy</span>
          </div>
          <div className="consent-body">
            <p className="consent-kicker">Your choice</p>
            <h2 id="consent-title">Analytics, on your terms.</h2>
            <p>
              We use PostHog to learn which pages and copy actions help people start. It stays off
              until you choose.
            </p>
            <a href="/privacy">Read the privacy page ↗</a>
            <div className="consent-actions">
              <button className="consent-refuse" onClick={() => choose('rejected')} type="button">
                Refuse
              </button>
              <button className="consent-accept" onClick={() => choose('accepted')} type="button">
                Accept analytics
              </button>
            </div>
          </div>
        </aside>
      ) : (
        <button
          aria-label="Open privacy settings"
          className="consent-settings-trigger"
          onClick={() => setIsSettingsOpen(true)}
          type="button"
        >
          Privacy settings
        </button>
      )}
    </>
  )
}
