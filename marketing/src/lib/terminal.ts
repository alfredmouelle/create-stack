export const TERMINAL_STEP_MS = 1000

export interface TerminalPlaybackState {
  visibleLineCount: number
  isPlaying: boolean
}

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
