/**
 * One short beep via Web Audio API. Never loops.
 * Failures (blocked autoplay, missing AudioContext) are ignored.
 */

const BEEP_SECONDS = 0.16

export function playNoticeBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + BEEP_SECONDS)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + BEEP_SECONDS + 0.02)
    osc.onended = () => {
      void ctx.close().catch(() => undefined)
    }
  } catch {
    /* notification UI still works without audio */
  }
}
