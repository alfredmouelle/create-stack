import { useEffect, useState } from 'react'
import { terminalLines } from '../data/landing'
import {
  advanceTerminalPlayback,
  startTerminalPlayback,
  TERMINAL_STEP_MS,
  type TerminalPlaybackState,
} from '../lib/terminal'

export default function Terminal() {
  const [playback, setPlayback] = useState<TerminalPlaybackState>({
    visibleLineCount: terminalLines.length,
    isPlaying: false,
  })

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setPlayback(startTerminalPlayback(reducedMotion, terminalLines.length))
  }, [])

  useEffect(() => {
    if (!playback.isPlaying) return

    const timer = window.setInterval(() => {
      setPlayback((current) => advanceTerminalPlayback(current, terminalLines.length))
    }, TERMINAL_STEP_MS)
    return () => window.clearInterval(timer)
  }, [playback.isPlaying])

  function replay() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setPlayback(startTerminalPlayback(reducedMotion, terminalLines.length))
  }

  function togglePlayback() {
    if (playback.isPlaying) {
      setPlayback((current) => ({ ...current, isPlaying: false }))
      return
    }

    if (playback.visibleLineCount === terminalLines.length) {
      replay()
      return
    }

    setPlayback((current) => ({ ...current, isPlaying: true }))
  }

  return (
    <section
      aria-busy={playback.isPlaying}
      aria-labelledby="terminal-session-title"
      className="terminal"
      data-playback={playback.isPlaying ? 'playing' : 'paused'}
    >
      <h2 className="sr-only" id="terminal-session-title">
        Example Create Stack terminal session
      </h2>
      <div className="terminal-topbar">
        <span aria-hidden="true" className="terminal-window">
          <i />
          <i />
          <i />
        </span>
        <span>create-stack / session 01</span>
      </div>
      <div aria-live="polite" className="terminal-lines">
        {terminalLines.slice(0, playback.visibleLineCount).map((line) => (
          <span className={`terminal-line ${line.kind}`} key={line.text}>
            {line.text}
          </span>
        ))}
      </div>
      <div className="terminal-footer">
        <span>
          {playback.isPlaying
            ? 'sequence playing'
            : playback.visibleLineCount === terminalLines.length
              ? 'selected stack · ready to run'
              : 'sequence paused'}
        </span>
        <button className="terminal-button" onClick={togglePlayback} type="button">
          {playback.isPlaying
            ? 'Pause sequence'
            : playback.visibleLineCount === terminalLines.length
              ? 'Replay sequence'
              : 'Resume sequence'}
        </button>
      </div>
    </section>
  )
}
