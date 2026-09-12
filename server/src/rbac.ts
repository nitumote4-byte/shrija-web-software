/**
 * Server-side role checks for tenant data APIs.
 * UI hiding is not authorization — every data route must use these helpers.
 */
import type { NextFunction, Request, Response } from 'express'
import type { AuthUser } from './middleware/auth.js'

export const KNOWN_ROLES = [
  'admin',
  'quality_manager',
  'reception',
  'assay_lab',
  'in_lab',
  'inlab',
  'accountant',
] as const

export type KnownRole = (typeof KNOWN_ROLES)[number]

const LAB_ROLES = new Set(['assay_lab', 'in_lab', 'inlab'])
const ADMIN_ROLES = new Set(['admin', 'quality_manager'])

export const LAB_STORE_KEYS = [
  'parties',
  'categories',
  'jewelleryCategories',
  'requests',
  'fireAssays',
  'stock',
  'xrfStandards',
  'xrfStandardSettings',
  'xrfStandardChecks',
] as const

export const RECEPTION_STORE_KEYS = [
  'parties',
  'categories',
  'jewelleryCategories',
  'requests',
  'roughSheets',
  'pendingRough',
  'invoices',
  'monthlyInvoices',
  'funds',
  'expenses',
  'touches',
  'xray',
  'xrfStandardChecks',
  'xrfStandards',
  'xrfStandardSettings',
  'purchaseParties',
] as const

export const ACCOUNTANT_STORE_KEYS = [
  'parties',
  'categories',
  'jewelleryCategories',
  'requests',
  'invoices',
  'monthlyInvoices',
  'funds',
  'expenses',
  'stock',
  'touches',
  'fireAssays',
] as const

/** KV keys that only centre admin / QM may read or write. */
export const ADMIN_ONLY_KV_KEYS = ['manak_credentials', 'shrija-staff'] as const

export function normalizeRole(role?: string | null): string {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export function isKnownRole(role?: string | null): boolean {
  return (KNOWN_ROLES as readonly string[]).includes(normalizeRole(role))
}

export function isLabRole(role?: string | null): boolean {
  return LAB_ROLES.has(normalizeRole(role))
}

export function isAdminUser(user: Pick<AuthUser, 'role' | 'isAdmin'> | null | undefined): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  return ADMIN_ROLES.has(normalizeRole(user.role))
}

export function storeKeysForRole(role?: string | null): '*' | readonly string[] {
  const r = normalizeRole(role)
  if (ADMIN_ROLES.has(r)) return '*'
  if (LAB_ROLES.has(r)) return LAB_STORE_KEYS
  if (r === 'reception') return RECEPTION_STORE_KEYS
  if (r === 'accountant') return ACCOUNTANT_STORE_KEYS
  return []
}

function asObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

/** Drop store keys this role is not allowed to read or write. */
export function pickStoreForRole(payload: unknown, role?: string | null): Record<string, unknown> {
  const data = asObjectRecord(payload)
  const keys = storeKeysForRole(role)
  if (keys === '*') return data
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in data) out[key] = data[key]
  }
  return out
}

export function isAdminOnlyKvKey(key: string): boolean {
  return (ADMIN_ONLY_KV_KEYS as readonly string[]).includes(String(key))
}

export function filterKvForRole(
  docs: Record<string, unknown>,
  user: Pick<AuthUser, 'role' | 'isAdmin'>,
): Record<string, unknown> {
  if (isAdminUser(user)) return docs
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(docs)) {
    if (isAdminOnlyKvKey(key)) continue
    out[key] = value
  }
  return out
}

export function redactFirmProfileForRole(
  profile: Record<string, unknown>,
  user: Pick<AuthUser, 'role' | 'isAdmin'>,
): Record<string, unknown> {
  if (!isLabRole(user.role) || isAdminUser(user)) return profile
  return {
    firmName: profile.firmName,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    centres: profile.centres,
  }
}

export function canUseManakDesk(user: Pick<AuthUser, 'role' | 'isAdmin'>): boolean {
  if (isAdminUser(user)) return true
  return normalizeRole(user.role) === 'reception'
}

export function requireKnownRole(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  if (isAdminUser(user) || isKnownRole(user.role)) {
    next()
    return
  }
  res.status(403).json({ error: 'This role cannot access centre data', code: 'FORBIDDEN_ROLE' })
}

export function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  if (!isAdminUser(req.user)) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}
