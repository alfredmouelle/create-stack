import type { GateStepId } from '../data/landing'

export const TERMINAL_STEP_MS = 600

export interface TerminalPlaybackState {
  visibleLineCount: number
  isPlaying: boolean
}

export type GateStepStatus = 'pending' | 'running' | 'passed'

export function startTerminalPlayback(
  reducedMotion: boolean,
  totalLines: number,
): TerminalPlaybackState {
  if (reducedMotion || totalLines === 0) {
    return { visibleLineCount: totalLines, isPlaying: false }
  }

  return { visibleLineCount: 1, isPlaying: true }
}

export function advanceTerminalPlayback(
  state: TerminalPlaybackState,
  totalLines: number,
): TerminalPlaybackState {
  if (!state.isPlaying || state.visibleLineCount >= totalLines) {
    return state
  }

  const visibleLineCount = Math.min(state.visibleLineCount + 1, totalLines)
  return { visibleLineCount, isPlaying: visibleLineCount < totalLines }
}

export function gateStepStatuses(
  steps: readonly { id: GateStepId }[],
  visibleLines: readonly { passes?: readonly GateStepId[] }[],
  gateStarted: boolean,
): GateStepStatus[] {
  const passed = new Set(visibleLines.flatMap((line) => line.passes ?? []))
  const running = steps.find((step) => !passed.has(step.id))

  return steps.map((step) => {
    if (passed.has(step.id)) return 'passed'
    return gateStarted && step === running ? 'running' : 'pending'
  })
}
