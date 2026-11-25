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
  'deletedInvoices',
  'deletedFunds',
  'deletedExpenses',
  'deletedMonthlyInvoices',
  'funds',
  'expenses',
  'touches',
  'xray',
  'xrfStandardChecks',
  'xrfStandards',
  'xrfStandardSettings',
  'purchaseParties',
  'otherServiceTypes',
  'otherServices',
  'otherServiceReceipts',
  'otherServiceAudit',
] as const

export const ACCOUNTANT_STORE_KEYS = [
  'parties',
  'categories',
  'jewelleryCategories',
  'requests',
  'invoices',
  'monthlyInvoices',
  'deletedInvoices',
  'deletedFunds',
  'deletedExpenses',
  'deletedMonthlyInvoices',
  'funds',
  'expenses',
  'stock',
  'touches',
  'fireAssays',
  'otherServiceTypes',
  'otherServices',
  'otherServiceReceipts',
  'otherServiceAudit',
] as const

/**
 * KV keys that only centre admin / QM may read or write.
 * Include both normalized storage keys and legacy `shrija-` aliases —
 * the client strips the `shrija-` prefix before calling the API.
 */
export const ADMIN_ONLY_KV_KEYS = [
  'manak_credentials',
  'staff',
  'shrija-staff',
  'reception-creds',
  'shrija-reception-creds',
] as const

/** Strip `shrija-` prefix so ACL matches client-normalized KV keys. */
export function normalizeKvKeyForAcl(key: string): string {
  const k = String(key || '').trim()
  return k.startsWith('shrija-') ? k.slice('shrija-'.length) : k
}

const ADMIN_ONLY_KV_NORMALIZED = new Set(
  (ADMIN_ONLY_KV_KEYS as readonly string[]).map((k) => normalizeKvKeyForAcl(k)),
)

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

/**
 * Admin permission is the database role `admin` only.
 * A browser tick, a forged isAdmin flag, or a request body cannot grant it.
 * The signed-in user cannot change their own role.
 */
export function resolveUserAdminGrant(input: {
  role: string
  selfUserId: string
  previous?: { id: string; role: string; isAdmin: boolean } | null
}): { isAdmin: boolean; role: string } {
  const prev = input.previous
  if (prev && prev.id === input.selfUserId) {
    return { role: prev.role, isAdmin: normalizeRole(prev.role) === 'admin' }
  }
  return { role: input.role, isAdmin: normalizeRole(input.role) === 'admin' }
}

export type CentreAdminSnapshot = {
  id: string
  role: string
  isAdmin: boolean
  createdAt?: string | Date | null
}

function createdAtMillis(value: CentreAdminSnapshot['createdAt']): number {
  if (value instanceof Date) return value.getTime()
  const n = Date.parse(String(value || ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * If the centre has no Admin role, the oldest account becomes Admin.
 * Every other account loses a leftover is_admin flag. Returns rows to write.
 */
export function planCentreAdminRepair(users: CentreAdminSnapshot[]): CentreAdminSnapshot[] {
  if (!users.length) return []
  const oldest = [...users].sort((a, b) => {
    const delta = createdAtMillis(a.createdAt) - createdAtMillis(b.createdAt)
    if (delta !== 0) return delta
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]
  const hasAdmin = users.some((u) => normalizeRole(u.role) === 'admin')
  const updates: CentreAdminSnapshot[] = []
  for (const user of users) {
    const promote = !hasAdmin && user.id === oldest.id
    const role = promote ? 'admin' : user.role
    const isAdmin = normalizeRole(role) === 'admin'
    if (normalizeRole(role) !== normalizeRole(user.role) || isAdmin !== Boolean(user.isAdmin)) {
      updates.push({ id: user.id, role, isAdmin, createdAt: user.createdAt })
    }
  }
  return updates
}

export function isAdminUser(user: Pick<AuthUser, 'role' | 'isAdmin'> | null | undefined): boolean {
  if (!user) return false
  return normalizeRole(user.role) === 'admin'
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
  return ADMIN_ONLY_KV_NORMALIZED.has(normalizeKvKeyForAcl(key))
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
