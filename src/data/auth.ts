import {
  api,
  ApiRequestError,
  clearAuth,
  getToken,
  readStoredSession,
  setAuth,
  type ApiSession,
} from '../api/client'
import { flushStoreNow, hydrateTenantData, resetTenantCache } from './tenantCache'
import { setCachedLicense, type LicenseStatus } from './license'

export type AuthSession = ApiSession

export function getSession(): AuthSession | null {
  return readStoredSession()
}

export function isAuthenticated(): boolean {
  return Boolean(getToken() && readStoredSession())
}

export function clearSession() {
  void flushStoreNow()
  clearAuth()
  resetTenantCache()
  setCachedLicense(null)
}

export function setSession(session: AuthSession) {
  const token = getToken()
  if (token) setAuth(token, session)
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  return api<{ ok: true; message: string }>('/api/auth/change-password', {
    method: 'POST',
    json: { currentPassword, newPassword },
  })
}

/** Verify the signed-in user's login password. Does not store or return the password. */
export async function verifyLoginPassword(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api<{ ok: true }>('/api/auth/verify-password', {
      method: 'POST',
      json: { password },
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof ApiRequestError) {
      return { ok: false, error: e.message }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Password verification failed' }
  }
}

export async function requestPasswordReset(username: string) {
  return api<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    json: { username },
  })
}

export async function confirmPasswordReset(token: string, password: string) {
  return api<{ ok: true; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    json: { token, password },
  })
}

export async function refreshSessionFromServer() {
  const result = await api<{ session: AuthSession; license?: LicenseStatus }>('/api/auth/me')
  const token = getToken()
  if (token && result.session) {
    setAuth(token, result.session)
  }
  if (result.license) setCachedLicense(result.license)
  return result.session
}

export async function login(
  username: string,
  password: string,
): Promise<{ ok: true; session: AuthSession; licenseExpired?: boolean } | { ok: false; error: string }> {
  try {
    const result = await api<{ token: string; session: AuthSession; license?: LicenseStatus }>(
      '/api/auth/login',
      {
        method: 'POST',
        json: { username, password },
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
type StoredCentre = { id: string; kind?: 'main' | 'osc'; name?: string; address?: string }

/** Access Management — server-enforced to JWT tenant */
export async function saveAccessUsers(users: StoredUser[]) {
  await api('/api/auth/users', { method: 'PUT', json: { users } })
}

export async function loadAccessUsers(): Promise<{ users: StoredUser[]; centres: StoredCentre[] }> {
  const result = await api<{
    users: { username: string; role: string; centreId?: string }[]
    centres?: StoredCentre[]
  }>('/api/auth/users')
  return {
    users: result.users.map((u) => ({
      username: u.username,
      role: u.role,
      password: '******',
      centreId: u.centreId || 'main',
    })),
    centres: Array.isArray(result.centres) ? result.centres : [],
  }
}
