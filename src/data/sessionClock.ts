const TOKEN_KEY = 'shrija-auth-token'
const LAST_ACTIVE_KEY = 'shrija-last-active'

/** Sign out after this long with no click, key, or scroll. */
export const SESSION_IDLE_MS = 30 * 60 * 1000

const ACTIVITY_WRITE_MS = 30 * 1000

function tokenExpiryMs(token: string): number | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown }
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

export function markSessionActivity() {
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
}

export function clearSessionActivity() {
  localStorage.removeItem(LAST_ACTIVE_KEY)
}

/** True only when a token exists, is unexpired, and the idle window is still open. */
export function sessionStillValid(): boolean {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return false
  const exp = tokenExpiryMs(token)
  if (exp !== null && Date.now() >= exp) return false
  const raw = localStorage.getItem(LAST_ACTIVE_KEY)
  if (!raw) return true
  const then = Number(raw)
  if (!Number.isFinite(then)) return false
  return Date.now() - then < SESSION_IDLE_MS
}

export function startSessionClock(onExpire: () => void) {
  let lastWrite = 0

  const enforce = () => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    if (!localStorage.getItem(LAST_ACTIVE_KEY)) markSessionActivity()
    if (!sessionStillValid()) onExpire()
  }

  const onActivity = () => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    if (!sessionStillValid()) {
      enforce()
      return
    }
    const now = Date.now()
    if (now - lastWrite < ACTIVITY_WRITE_MS) return
    lastWrite = now
    markSessionActivity()
  }

  enforce()
  window.setInterval(enforce, 20 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') enforce()
  })
  window.addEventListener('pointerdown', onActivity, { passive: true })
  window.addEventListener('keydown', onActivity)
  window.addEventListener('touchstart', onActivity, { passive: true })
  window.addEventListener('scroll', onActivity, { passive: true })
}
