const TOKEN_KEY = 'shrija-auth-token'
const SESSION_KEY = 'shrija-auth-session'

export type ApiSession = {
  username: string
  role: string
  isAdmin: boolean
  loggedInAt: string
  tenantId: string
  tenantName: string
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuth(token: string, session: ApiSession) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem('shrija-active-tenant', session.tenantId)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('shrija-active-tenant')
}

export function readStoredSession(): ApiSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ApiSession
    if (!parsed.tenantId || !getToken()) return null
    return parsed
  } catch {
    return null
  }
}

type ApiError = { error?: string }

/** Production: set VITE_API_URL to Railway API origin (no trailing slash). Local: leave empty (Vite proxy). */
function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || ''
  const p = path.startsWith('/api') ? path : `/api${path}`
  return `${base}${p}`
}

export async function api<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  })

  let body: unknown = null
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { error: text }
    }
  }

  if (!res.ok) {
    const msg = (body as ApiError)?.error || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return body as T
}
