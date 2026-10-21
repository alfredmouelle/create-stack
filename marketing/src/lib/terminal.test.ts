import { describe, expect, it } from 'vitest'
import { GATE_STEPS, terminalLines } from '../data/landing'
import {
  advanceTerminalPlayback,
  gateStepStatuses,
  startTerminalPlayback,
  TERMINAL_STEP_MS,
} from './terminal'

const lines = terminalLines

describe('terminal playback', () => {
  it('starts at the command and advances one transcript line at a time', () => {
    const initial = startTerminalPlayback(false, lines.length)

    expect(initial).toEqual({ visibleLineCount: 1, isPlaying: true })
    expect(advanceTerminalPlayback(initial, lines.length)).toEqual({
      visibleLineCount: 2,
      isPlaying: true,
    })
  })

  it('stops exactly on the created project line', () => {
    const final = advanceTerminalPlayback(
      { visibleLineCount: lines.length - 1, isPlaying: true },
      lines.length,
    )

    expect(final).toEqual({ visibleLineCount: lines.length, isPlaying: false })
    expect(lines.at(-1)?.text).toBe('Created my-app')
  })

  it('resolves to the finished state for reduced-motion visitors', () => {
    expect(startTerminalPlayback(true, lines.length)).toEqual({
      visibleLineCount: lines.length,
      isPlaying: false,
    })
  })

  it('uses a fixed interval so the sequence is deterministic', () => {
    expect(TERMINAL_STEP_MS).toBe(600)
  })
})

describe('gate step statuses', () => {
  it('keeps every step pending before the gate starts', () => {
    expect(gateStepStatuses(GATE_STEPS, lines.slice(0, 3), false)).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ])
  })

  it('runs the first unfinished step once the gate has started', () => {
    expect(gateStepStatuses(GATE_STEPS, lines.slice(0, 11), true)).toEqual([
      'passed',
      'passed',
      'running',
      'pending',
      'pending',
    ])
  })

  it('passes every step, commit included, at the end of the transcript', () => {
    expect(gateStepStatuses(GATE_STEPS, lines, true)).toEqual([
      'passed',
      'passed',
      'passed',
      'passed',
      'passed',
    ])
  })
})
