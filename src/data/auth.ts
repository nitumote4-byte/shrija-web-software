import {
  api,
  ApiRequestError,
  clearAuth,
  getToken,
  readStoredSession,
  setAuth,
  type ApiSession,
} from '../api/client'
import { hydrateTenantData, resetTenantCache } from './tenantCache'
import { setCachedLicense, type LicenseStatus } from './license'

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
  setCachedLicense(null)
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
): Promise<{ ok: true; session: AuthSession; licenseExpired?: boolean } | { ok: false; error: string }> {
  try {
    const result = await api<{ token: string; session: AuthSession; license?: LicenseStatus }>(
      '/api/auth/login',
      {
        method: 'POST',
        json: { tenantId, username, password, asAdmin },
      },
    )
    setAuth(result.token, result.session)
    if (result.license) setCachedLicense(result.license)

    if (result.license && !result.license.ok) {
      return { ok: true, session: result.session, licenseExpired: true }
    }

    await hydrateTenantData()
    return { ok: true, session: result.session }
  } catch (e) {
    if (e instanceof ApiRequestError) {
      return { ok: false, error: e.message }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Login failed' }
  }
}

export function getCurrentTenantName() {
  return getSession()?.tenantName || ''
}

type StoredUser = { username: string; role: string; password: string; centreId?: string }

/** Access Management — server-enforced to JWT tenant */
export async function saveAccessUsers(users: StoredUser[]) {
  await api('/api/auth/users', { method: 'PUT', json: { users } })
}

export async function loadAccessUsers(): Promise<StoredUser[]> {
  const result = await api<{ users: { username: string; role: string; centreId?: string }[] }>(
    '/api/auth/users',
  )
  return result.users.map((u) => ({
    username: u.username,
    role: u.role,
    password: '******',
    centreId: u.centreId || 'main',
  }))
}
