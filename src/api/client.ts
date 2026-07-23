const TOKEN_KEY = 'shrija-auth-token'
const SESSION_KEY = 'shrija-auth-session'

export type ApiSession = {
  username: string
  role: string
  isAdmin: boolean
  loggedInAt: string
  tenantId: string
  tenantName: string
  /** Main or Off-Site outlet under the same GST firm */
  centreId?: string
  centreKind?: 'main' | 'osc'
  centreName?: string
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

type ApiError = { error?: string; code?: string }

export class ApiRequestError extends Error {
  status: number
  code?: string
  body?: unknown
  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.body = body
  }
}

/** Prefer same-origin /api (Vercel rewrite → Railway). Set VITE_API_URL only for direct API calls. */
function apiUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || ''
  const p = path.startsWith('/api') ? path : `/api${path}`
  // Empty base = browser calls /api on current host (works with Vercel proxy + local Vite proxy)
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
    const code = (body as ApiError)?.code
    throw new ApiRequestError(msg, res.status, code, body)
  }
  return body as T
}
