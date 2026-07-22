import { CENTRE_NAME } from './modules'
import { getActiveTenant } from './tenant'
import { getSession, setSession } from './auth'
import { getFirmCache, setFirmCache } from './tenantCache'
import { setAuth, getToken } from '../api/client'

export const FIRM_PROFILE_KEY = 'shrija-firm-profile'
export const FIRM_PROFILE_EVENT = 'shrija-firm-updated'

export type FirmProfile = {
  firmName: string
  email?: string
  address?: string
  gstNo?: string
  bankName?: string
  accountNo?: string
  ifsc?: string
  city?: string
  state?: string
}

export function getFirmProfile(): FirmProfile {
  try {
    const cached = getFirmCache() as Partial<FirmProfile> | null
    const t = getActiveTenant()
    if (!cached) {
      return { firmName: t?.firmName || CENTRE_NAME, gstNo: t?.gstin || '' }
    }
    return {
      firmName: (cached.firmName || t?.firmName || '').trim() || CENTRE_NAME,
      email: cached.email,
      address: cached.address,
      gstNo: cached.gstNo || t?.gstin,
      bankName: cached.bankName,
      accountNo: cached.accountNo,
      ifsc: cached.ifsc,
      city: cached.city,
      state: cached.state,
    }
  } catch {
    return { firmName: CENTRE_NAME }
  }
}

export function getFirmName() {
  return getFirmProfile().firmName
}

export function saveFirmProfile(profile: FirmProfile) {
  setFirmCache(profile as unknown as Record<string, unknown>)
  const session = getSession()
  const token = getToken()
  if (session && token) {
    const next = { ...session, tenantName: profile.firmName.trim() }
    setAuth(token, next)
    setSession(next)
  }
  window.dispatchEvent(new Event(FIRM_PROFILE_EVENT))
}
