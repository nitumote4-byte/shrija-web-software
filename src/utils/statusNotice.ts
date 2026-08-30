/** Visible duration before the exit animation starts. */
export const STATUS_NOTICE_DURATION_MS = 3000
/** Exit animation length; card is removed after duration + this. */
export const STATUS_NOTICE_EXIT_MS = 280

/**
 * Timeout-based auto-dismiss. Returns a cleanup that clears both timers
 * so nothing leaks if the host unmounts.
 */
export function scheduleStatusNoticeDismissal(
  onStartExit: () => void,
  onGone: () => void,
  durationMs = STATUS_NOTICE_DURATION_MS,
  exitMs = STATUS_NOTICE_EXIT_MS,
): () => void {
  const stay = window.setTimeout(onStartExit, durationMs)
  const gone = window.setTimeout(onGone, durationMs + exitMs)
  return () => {
    window.clearTimeout(stay)
    window.clearTimeout(gone)
  }
}
