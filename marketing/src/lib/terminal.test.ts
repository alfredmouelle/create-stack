import { describe, expect, it } from 'vitest'
import { terminalTranscript } from '../data/landing'
import { advanceTerminalPlayback, startTerminalPlayback, TERMINAL_STEP_MS } from './terminal'

describe('terminal playback', () => {
  it('starts at the command and advances one transcript line at a time', () => {
    const initial = startTerminalPlayback(false, terminalTranscript.lines.length)

    expect(initial).toEqual({ visibleLineCount: 1, isPlaying: true })
    expect(advanceTerminalPlayback(initial, terminalTranscript.lines.length)).toEqual({
      visibleLineCount: 2,
      isPlaying: true,
    })
  })

  it('stops exactly on the final successful verification line', () => {
    const final = advanceTerminalPlayback(
      { visibleLineCount: terminalTranscript.lines.length - 1, isPlaying: true },
      terminalTranscript.lines.length,
    )

    expect(final).toEqual({
      visibleLineCount: terminalTranscript.lines.length,
      isPlaying: false,
    })
    expect(terminalTranscript.lines.at(-1)?.text).toBe('✓ typecheck + biome clean')
  })

  it('resolves to the useful final state for reduced-motion visitors', () => {
    expect(startTerminalPlayback(true, terminalTranscript.lines.length)).toEqual({
      visibleLineCount: terminalTranscript.lines.length,
      isPlaying: false,
    })
  })

  it('uses a fixed interval so the sequence is deterministic', () => {
    expect(TERMINAL_STEP_MS).toBe(1000)
  })
})
