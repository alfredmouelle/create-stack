import { useEffect, useState } from 'react'
import { GATE_STEPS, terminalLines } from '../data/landing'
import {
  advanceTerminalPlayback,
  gateStepStatuses,
  startTerminalPlayback,
  TERMINAL_STEP_MS,
  type TerminalPlaybackState,
} from '../lib/terminal'

const GATE_START_LINE = terminalLines.findIndex((line) => line.text === 'pnpm install')

const LINE_PREFIX = {
  command: '$ ',
  heading: '◇  ',
  output: '│  ',
  step: '◆  ',
  success: '◆  ',
} as const

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function Terminal() {
  const [playback, setPlayback] = useState<TerminalPlaybackState>({
    visibleLineCount: terminalLines.length,
    isPlaying: false,
  })

  useEffect(() => {
    setPlayback(startTerminalPlayback(prefersReducedMotion(), terminalLines.length))
  }, [])

  useEffect(() => {
    if (!playback.isPlaying) return

    const timer = window.setInterval(() => {
      setPlayback((current) => advanceTerminalPlayback(current, terminalLines.length))
    }, TERMINAL_STEP_MS)
    return () => window.clearInterval(timer)
  }, [playback.isPlaying])

  const isFinished = playback.visibleLineCount === terminalLines.length
  const visibleLines = terminalLines.slice(0, playback.visibleLineCount)
  const statuses = gateStepStatuses(
    GATE_STEPS,
    visibleLines,
    playback.visibleLineCount > GATE_START_LINE && playback.isPlaying,
  )

  function togglePlayback() {
    if (playback.isPlaying) {
      setPlayback((current) => ({ ...current, isPlaying: false }))
      return
    }

    if (isFinished) {
      setPlayback(startTerminalPlayback(prefersReducedMotion(), terminalLines.length))
      return
    }

    setPlayback((current) => ({ ...current, isPlaying: true }))
  }

  return (
    <section
      aria-busy={playback.isPlaying}
      aria-labelledby="terminal-session-title"
      className="gate-demo"
      data-playback={playback.isPlaying ? 'playing' : 'paused'}
    >
      <h3 className="sr-only" id="terminal-session-title">
        Example Create Stack terminal session
      </h3>
      <div className="terminal">
        <div className="terminal-top">
          <span aria-hidden="true" className="terminal-dots">
            <i />
            <i />
            <i />
          </span>
          <span>my-app · create-stack</span>
          <button className="terminal-button" onClick={togglePlayback} type="button">
            {playback.isPlaying
              ? 'Pause sequence'
              : isFinished
                ? 'Replay sequence'
                : 'Resume sequence'}
          </button>
        </div>
        <div aria-live="polite" className="terminal-body">
          {visibleLines.map((line) => (
            <span className={`terminal-line is-${line.kind}`} key={line.text}>
              <span aria-hidden="true" className="terminal-prefix">
                {LINE_PREFIX[line.kind]}
              </span>
              {line.kind === 'command'
                ? line.text.split(' ').flatMap((token, index) => [
                    index ? ' ' : '',
                    <span className="terminal-token" key={`${index}-${token}`}>
                      {token}
                    </span>,
                  ])
                : line.text}
              {line.note ? <span className="terminal-note">, {line.note}</span> : null}
            </span>
          ))}
        </div>
      </div>
      <div className="gate-side">
        <ol aria-label="Verification gate" className="gate">
          {GATE_STEPS.map((step, index) => (
            <li className="gate-step" data-status={statuses[index]} key={step.id}>
              <span aria-hidden="true" className="gate-glyph" />
              <span className="gate-step-name">
                {step.label}
                <span className="gate-step-command">{step.command}</span>
              </span>
              <span className="gate-step-status">{statuses[index]}</span>
            </li>
          ))}
        </ol>
        <p className="gate-note">
          If a step fails, the CLI names it and skips the commit. You never start from a red
          project.
        </p>
      </div>
    </section>
  )
}
