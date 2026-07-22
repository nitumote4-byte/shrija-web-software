import type { ManakRequestRow } from './types.js'

type CookieJar = Map<string, string>

export type ManakSession = {
  id: string
  tenantId: string
  baseUrl: string
  username: string
  password: string
  cookies: CookieJar
  loginHtml?: string
  captchaField?: string
  createdAt: number
  lastError?: string
}

const TTL_MS = 10 * 60 * 1000
const sessions = new Map<string, ManakSession>()

export function putSession(session: ManakSession) {
  sessions.set(session.id, session)
  prune()
}

export function getSession(id: string, tenantId: string): ManakSession | null {
  prune()
  const s = sessions.get(id)
  if (!s || s.tenantId !== tenantId) return null
  if (Date.now() - s.createdAt > TTL_MS) {
    sessions.delete(id)
    return null
  }
  return s
}

export function deleteSession(id: string) {
  sessions.delete(id)
}

function prune() {
  const now = Date.now()
  for (const [id, s] of sessions) {
    if (now - s.createdAt > TTL_MS) sessions.delete(id)
  }
}

export function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

export function mergeSetCookie(jar: CookieJar, headers: Headers) {
  const raw = headers.getSetCookie?.() ?? []
  const fallback = headers.get('set-cookie')
  const list = raw.length ? raw : fallback ? [fallback] : []
  for (const line of list) {
    const part = line.split(';')[0]
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
  }
}

export type { ManakRequestRow }
