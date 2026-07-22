import { api } from '../api/client'

export type LicenseStatus = {
  ok: boolean
  plan: string
  status: string
  licenseKey: string | null
  expiresAt: string | null
  activatedAt: string | null
  maxUsers: number
  daysLeft: number | null
  reason?: string
  code?: 'OK' | 'EXPIRED' | 'SUSPENDED' | 'MISSING'
}

const CACHE_KEY = 'shrija-license-status'

export function getCachedLicense(): LicenseStatus | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LicenseStatus
  } catch {
    return null
  }
}

export function setCachedLicense(license: LicenseStatus | null) {
  if (!license) sessionStorage.removeItem(CACHE_KEY)
  else sessionStorage.setItem(CACHE_KEY, JSON.stringify(license))
}

export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  const result = await api<{ license: LicenseStatus }>('/api/license/status')
  setCachedLicense(result.license)
  return result.license
}

export async function activateLicenseKey(licenseKey: string): Promise<LicenseStatus> {
  const result = await api<{ license: LicenseStatus }>('/api/license/activate', {
    method: 'POST',
    json: { licenseKey },
  })
  setCachedLicense(result.license)
  return result.license
}

export async function issueLicenseKeys(input: {
  masterSecret: string
  plan?: 'trial' | 'standard' | 'pro'
  durationDays?: number
  maxUsers?: number
  count?: number
  note?: string
}) {
  return api<{
    keys: string[]
    plan: string
    durationDays: number
    maxUsers: number
  }>('/api/license/issue', {
    method: 'POST',
    json: input,
  })
}

export async function listIssuedKeys(masterSecret: string) {
  return api<{
    keys: Array<{
      code: string
      plan: string
      durationDays: number
      maxUsers: number
      note: string
      createdAt: string
      usedByTenantId: string | null
      usedAt: string | null
    }>
  }>('/api/license/issued', {
    method: 'POST',
    json: { masterSecret },
  })
}

export function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return 'No expiry (legacy)'
  return new Date(expiresAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
