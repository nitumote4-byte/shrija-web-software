import { api, clearAuth, getToken, readStoredSession, setAuth, type ApiSession } from '../api/client'
import { hydrateTenantData, resetTenantCache } from './tenantCache'

export type AuthSession = ApiSession

export function getSession(): AuthSession | null {
  return readStoredSession()
}

export function isAuthenticated(): boolean {
  return Boolean(getToken() && readStoredSession())
}

export function clearSession() {
  clearAuth()
  resetTenantCache()
}

export function setSession(session: AuthSession) {
  const token = getToken()
  if (token) setAuth(token, session)
}

export async function login(
  username: string,
  password: string,
  tenantId: string,
  asAdmin = false,
): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }> {
  try {
    const result = await api<{ token: string; session: AuthSession }>('/api/auth/login', {
      method: 'POST',
      json: { tenantId, username, password, asAdmin },
    })
    setAuth(result.token, result.session)
    await hydrateTenantData()
    return { ok: true, session: result.session }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Login failed' }
  }
}

export function getCurrentTenantName() {
  return getSession()?.tenantName || ''
}

type StoredUser = { username: string; role: string; password: string }

/** Access Management — server-enforced to JWT tenant */
export async function saveAccessUsers(users: StoredUser[]) {
  await api('/api/auth/users', { method: 'PUT', json: { users } })
}

export async function loadAccessUsers(): Promise<StoredUser[]> {
  const result = await api<{ users: { username: string; role: string }[] }>('/api/auth/users')
  return result.users.map((u) => ({
    username: u.username,
    role: u.role,
    password: '******',
  }))
}
