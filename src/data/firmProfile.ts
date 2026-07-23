import { CENTRE_NAME } from './modules'
import { getActiveTenant } from './tenant'
import { getSession, setSession } from './auth'
import { getFirmCache, setFirmCache } from './tenantCache'
import { setAuth, getToken } from '../api/client'

export const FIRM_PROFILE_KEY = 'shrija-firm-profile'
export const FIRM_PROFILE_EVENT = 'shrija-firm-updated'

export type CentreKind = 'main' | 'osc'

export type CentreOutlet = {
  id: string
  kind: CentreKind
  /** Print / display name (OSC often includes “Off-Site Centre”) */
  name: string
  address: string
  city?: string
  state?: string
}

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
  /** Main + Off-Site outlets under the same GSTIN */
  centres?: CentreOutlet[]
}

export function defaultMainCentre(profile: Pick<FirmProfile, 'firmName' | 'address' | 'city' | 'state'>): CentreOutlet {
  return {
    id: 'main',
    kind: 'main',
    name: (profile.firmName || CENTRE_NAME).trim() || CENTRE_NAME,
    address: profile.address || '',
    city: profile.city,
    state: profile.state,
  }
}

/** Ensure Main exists; keep firm address as Main address when syncing. */
export function normalizeCentres(profile: FirmProfile): CentreOutlet[] {
  const main = defaultMainCentre(profile)
  const raw = Array.isArray(profile.centres) ? profile.centres : []
  const others = raw
    .filter((c) => c && c.id && c.kind === 'osc')
    .map((c) => ({
      id: String(c.id),
      kind: 'osc' as const,
      name: String(c.name || 'Off-Site Centre').trim() || 'Off-Site Centre',
      address: String(c.address || '').trim(),
      city: c.city ? String(c.city) : undefined,
      state: c.state ? String(c.state) : undefined,
    }))
  const existingMain = raw.find((c) => c?.kind === 'main' || c?.id === 'main')
  return [
    {
      ...main,
      name: (existingMain?.name || main.name).trim() || main.name,
      address: (profile.address || existingMain?.address || '').trim(),
      city: profile.city || existingMain?.city,
      state: profile.state || existingMain?.state,
    },
    ...others,
  ]
}

export function getFirmProfile(): FirmProfile {
  try {
    const cached = getFirmCache() as Partial<FirmProfile> | null
    const t = getActiveTenant()
    if (!cached) {
      const base = { firmName: t?.firmName || CENTRE_NAME, gstNo: t?.gstin || '' }
      return { ...base, centres: normalizeCentres(base) }
    }
    const profile: FirmProfile = {
      firmName: (cached.firmName || t?.firmName || '').trim() || CENTRE_NAME,
      email: cached.email,
      address: cached.address,
      gstNo: cached.gstNo || t?.gstin,
      bankName: cached.bankName,
      accountNo: cached.accountNo,
      ifsc: cached.ifsc,
      city: cached.city,
      state: cached.state,
      centres: cached.centres as CentreOutlet[] | undefined,
    }
    return { ...profile, centres: normalizeCentres(profile) }
  } catch {
    return { firmName: CENTRE_NAME, centres: normalizeCentres({ firmName: CENTRE_NAME }) }
  }
}

export function getFirmName() {
  return getFirmProfile().firmName
}

export function getCentres(): CentreOutlet[] {
  return normalizeCentres(getFirmProfile())
}

export function getCentreById(centreId?: string | null): CentreOutlet {
  const centres = getCentres()
  if (centreId) {
    const found = centres.find((c) => c.id === centreId)
    if (found) return found
  }
  return centres.find((c) => c.kind === 'main') || centres[0]
}

/** Active centre from logged-in user (OSC outlet or Main). */
export function getActiveCentre(): CentreOutlet {
  const session = getSession()
  return getCentreById(session?.centreId)
}

/**
 * Invoice / challan header:
 * GSTIN always from firm (Main GST);
 * name + address from active (or given) centre / outlet.
 */
export function getInvoiceHeader(centreId?: string | null): {
  firmName: string
  centreName: string
  centreAddress: string
  centreGstin: string
  centreKind: CentreKind
  bankName?: string
  accountNo?: string
  ifsc?: string
} {
  const firm = getFirmProfile()
  const centre = getCentreById(centreId ?? getSession()?.centreId)
  const addrParts = [centre.address, centre.city, centre.state].filter(Boolean)
  return {
    firmName: firm.firmName,
    centreName: centre.name || firm.firmName || 'Hallmarking Centre',
    centreAddress: addrParts.join(', ') || firm.address || '',
    centreGstin: firm.gstNo || '—',
    centreKind: centre.kind,
    bankName: firm.bankName,
    accountNo: firm.accountNo,
    ifsc: firm.ifsc,
  }
}

export function saveFirmProfile(profile: FirmProfile) {
  const centres = normalizeCentres(profile)
  const toSave = { ...profile, centres }
  setFirmCache(toSave as unknown as Record<string, unknown>)
  const session = getSession()
  const token = getToken()
  if (session && token) {
    const active = getCentreById(session.centreId)
    const next = {
      ...session,
      tenantName: profile.firmName.trim(),
      centreId: active.id,
      centreKind: active.kind,
      centreName: active.name,
    }
    setAuth(token, next)
    setSession(next)
  }
  window.dispatchEvent(new Event(FIRM_PROFILE_EVENT))
}
