import { useEffect, useState } from 'react'
import { terminalLines } from '../data/landing'

export default function Terminal() {
  const [visibleLines, setVisibleLines] = useState<number>(terminalLines.length)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    const timer = window.setInterval(() => {
      setVisibleLines((current) => {
        const next = Math.min(current + 1, terminalLines.length)
        if (next === terminalLines.length) {
          setIsPlaying(false)
        }
        return next
      })
    }, 850)

    return () => window.clearInterval(timer)
  }, [isPlaying])

  function replay() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setVisibleLines(terminalLines.length)
      setIsPlaying(false)
      return
    }

    setVisibleLines(0)
    setIsPlaying(true)
  }

  function togglePlayback() {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    if (visibleLines === terminalLines.length) {
      replay()
      return
    }

    setIsPlaying(true)
  }

  return (
    <section aria-label="Example Create Stack terminal session" className="terminal">
      <div className="terminal-topbar">
        <span aria-hidden="true" className="terminal-window">
          <i />
          <i />
          <i />
        </span>
        <span>create-stack / session 01</span>
      </div>
      <div aria-live="polite" className="terminal-lines">
        {terminalLines.slice(0, visibleLines).map((line) => (
          <span className={`terminal-line ${line.kind}`} key={line.text}>
            {line.text}
          </span>
        ))}
      </div>
      <div className="terminal-footer">
        <span>selected stack · ready to run</span>
        <button className="terminal-button" onClick={togglePlayback} type="button">
          {isPlaying
            ? 'Pause sequence'
            : visibleLines === terminalLines.length
              ? 'Replay sequence'
              : 'Resume sequence'}
        </button>
      </div>
    </section>
  )
}
