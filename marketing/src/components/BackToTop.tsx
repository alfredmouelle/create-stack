import { useEffect, useState } from 'react'

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    function updateVisibility() {
      setIsVisible(window.scrollY > 480)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  if (!isVisible) return null

  function scrollToTop() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth'
    window.scrollTo({ top: 0, behavior })
  }

  return (
    <button aria-label="Back to top" className="back-to-top" onClick={scrollToTop} type="button">
      <span aria-hidden="true">↑</span>
      <span>Top</span>
    </button>
  )
}
