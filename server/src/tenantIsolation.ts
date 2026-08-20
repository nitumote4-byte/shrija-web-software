/**
 * Multi-tenant isolation helpers.
 * Tenant/centre identity always comes from the verified JWT user record,
 * never from client-supplied tenantId / centreId / tenant_id fields.
 */

export const GENERIC_LOGIN_ERROR = 'Invalid username or password'

/** Identifiers that must match the JWT tenant when present. */
export const CLIENT_TENANT_ID_KEYS = ['tenantId', 'tenant_id', 'tenantCode'] as const

/** Outlet identifiers — never used to select a tenant; stripped from top-level request fields. */
export const CLIENT_CENTRE_ID_KEYS = [
  'centerId',
  'center_id',
  'centreId',
  'centre_id',
  'centerCode',
  'centreCode',
] as const

export const CLIENT_TENANT_OVERRIDE_KEYS = [
  ...CLIENT_TENANT_ID_KEYS,
  ...CLIENT_CENTRE_ID_KEYS,
] as const

export type ClientTenantOverrideKey = (typeof CLIENT_TENANT_OVERRIDE_KEYS)[number]

export type PasswordUser = {
  passwordHash: string
}

export type CentreScopedItem = {
  centreId?: string
  centreKind?: string
  requestNo?: string
}

export const CENTRE_SCOPED_STORE_KEYS = [
  'parties',
  'requests',
  'roughSheets',
  'pendingRough',
  'invoices',
  'monthlyInvoices',
  'funds',
  'expenses',
  'purchaseParties',
  'touches',
  'xray',
  'xrfStandardChecks',
  'fireAssays',
  'stock',
] as const

function readKeyedOverride(source: unknown, keys: readonly string[]): string | undefined {
  if (!source || typeof source !== 'object') return undefined
  const rec = source as Record<string, unknown>
  for (const key of keys) {
    const value = rec[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim()
    }
  }
  return undefined
}

export function readClientTenantOverride(source: unknown): string | undefined {
  return readKeyedOverride(source, CLIENT_TENANT_ID_KEYS)
}

export function readClientCentreOverride(source: unknown): string | undefined {
  return readKeyedOverride(source, CLIENT_CENTRE_ID_KEYS)
}

/**
 * Collect a tenant/centre override from body, query, or route params.
 * Express query values may be string | string[].
 */
export function collectClientTenantOverride(parts: {
  body?: unknown
  query?: unknown
  params?: unknown
}): string | undefined {
  return (
    readClientTenantOverride(parts.body) ||
    readClientTenantOverride(parts.query) ||
    readClientTenantOverride(parts.params)
  )
}

export function collectClientCentreOverride(parts: {
  body?: unknown
  query?: unknown
  params?: unknown
}): string | undefined {
  return (
    readClientCentreOverride(parts.body) ||
    readClientCentreOverride(parts.query) ||
    readClientCentreOverride(parts.params)
  )
}

/** True when the client tried to address a different tenant than the JWT. */
export function isCrossTenantOverride(authTenantId: string, clientValue?: string | null): boolean {
  if (!clientValue) return false
  return String(clientValue) !== String(authTenantId)
}

export function stripClientTenantOverrides<T extends Record<string, unknown>>(source: T): T {
  const next = { ...source }
  for (const key of CLIENT_TENANT_OVERRIDE_KEYS) {
    delete next[key]
  }
  return next
}

/**
 * Password match among users that share a username.
 * Exactly one match is required so login never needs a centre picker.
 */
export function selectPasswordMatch<T extends PasswordUser>(
  candidates: T[],
  password: string,
  compare: (plain: string, hash: string) => boolean,
): T | null {
  const matches: T[] = []
  for (const candidate of candidates) {
    if (!candidate?.passwordHash) continue
    let ok = false
    try {
      ok = compare(password, candidate.passwordHash)
    } catch {
      ok = false
    }
    if (ok) matches.push(candidate)
  }
  if (matches.length === 1) return matches[0]
  return null
}

export function itemBelongsToCentre(
  item: unknown,
  centreId: string,
): item is CentreScopedItem {
  if (!item || typeof item !== 'object') return false
  const rec = item as CentreScopedItem
  if (rec.centreId) return String(rec.centreId) === centreId
  return false
}

function asObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

/**
 * OSC sessions may only see records tagged with their JWT centreId.
 * Main-centre sessions intentionally receive the full same-tenant store so lab
 * handoff and OSC assay workflows work. This is never another Hallmark Centre:
 * store_docs / kv_docs / firm_profiles are always keyed by JWT tenant_id.
 */
export function filterStoreForSession(
  payload: unknown,
  opts: { centreId: string; centreKind: 'main' | 'osc' },
): Record<string, unknown> {
  const data = asObjectRecord(payload)
  if (opts.centreKind !== 'osc') return data

  const requests = Array.isArray(data.requests) ? data.requests : []
  const scopedRequests = requests.filter((item) => itemBelongsToCentre(item, opts.centreId))
  const requestNos = new Set(
    scopedRequests
      .map((r) => String((r as CentreScopedItem).requestNo || '').trim())
      .filter(Boolean),
  )

  const out: Record<string, unknown> = { ...data, requests: scopedRequests }
  for (const key of CENTRE_SCOPED_STORE_KEYS) {
    if (key === 'requests') continue
    const arr = data[key]
    if (!Array.isArray(arr)) continue
    out[key] = arr.filter((item) => {
      if (itemBelongsToCentre(item, opts.centreId)) return true
      const requestNo = String((item as CentreScopedItem).requestNo || '').trim()
      return Boolean(requestNo && requestNos.has(requestNo))
    })
  }
  return out
}

function stampOscItem(item: unknown, centreId: string): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null
  const rec = item as CentreScopedItem
  if (rec.centreId && rec.centreId !== centreId) return null
  return {
    ...(item as Record<string, unknown>),
    centreId,
    centreKind: 'osc',
  }
}

/**
 * OSC writes must not replace other outlets' rows in the tenant JSON store.
 * Incoming rows tagged with a different centreId are dropped.
 */
export function mergeOscStoreWrite(
  existing: unknown,
  incoming: unknown,
  centreId: string,
): Record<string, unknown> {
  const current = asObjectRecord(existing)
  const next = asObjectRecord(incoming)
  const merged: Record<string, unknown> = { ...current }

  for (const key of CENTRE_SCOPED_STORE_KEYS) {
    const existingArr = Array.isArray(current[key]) ? (current[key] as unknown[]) : []
    const incomingArr = Array.isArray(next[key]) ? (next[key] as unknown[]) : []
    const others = existingArr.filter((item) => !itemBelongsToCentre(item, centreId))
    const owned: Record<string, unknown>[] = []
    for (const item of incomingArr) {
      const stamped = stampOscItem(item, centreId)
      if (stamped) owned.push(stamped)
    }
    merged[key] = [...others, ...owned]
  }

  return merged
}

export type FirmOutlet = {
  id: string
  kind: 'main' | 'osc'
  name: string
  address?: string
  city?: string
  state?: string
}

function asCentresArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((c) => c && typeof c === 'object' && !Array.isArray(c)) as Record<string, unknown>[]
  }
  if (typeof raw === 'string') {
    try {
      return asCentresArray(JSON.parse(raw))
    } catch {
      return []
    }
  }
  return []
}

/** True when a firm_profiles.centres row is this tenant's Off-Site outlet (never another Hallmark Centre). */
export function isOscOutlet(c: { id?: unknown; kind?: unknown } | null | undefined): boolean {
  if (!c) return false
  const id = String(c.id || '').trim()
  if (!id || id === 'main') return false
  const kind = String(c.kind || '').trim().toLowerCase()
  if (kind === 'osc') return true
  if (id.toLowerCase().startsWith('osc')) return true
  if (kind === 'main') return false
  return true
}

/**
 * Main + OSC outlets stored on this tenant's firm profile.
 * Does not include other tenants — caller must pass JWT-scoped firm_profiles.centres.
 */
export function listFirmOutlets(
  centres: unknown,
  main: { name: string; address?: string; city?: string; state?: string },
): FirmOutlet[] {
  const raw = asCentresArray(centres)
  const existingMain = raw.find((c) => {
    const kind = String(c.kind || '').trim().toLowerCase()
    const id = String(c.id || '').trim()
    return kind === 'main' || id === 'main'
  })
  const osc: FirmOutlet[] = []
  const seen = new Set<string>()
  for (const c of raw) {
    if (!isOscOutlet(c)) continue
    const id = String(c.id).trim()
    if (seen.has(id)) continue
    seen.add(id)
    osc.push({
      id,
      kind: 'osc',
      name: String(c.name || 'Off-Site Centre').trim() || 'Off-Site Centre',
      address: String(c.address || ''),
      city: c.city != null ? String(c.city) : undefined,
      state: c.state != null ? String(c.state) : undefined,
    })
  }
  return [
    {
      id: 'main',
      kind: 'main',
      name: String(existingMain?.name || main.name || '').trim() || main.name,
      address: String(main.address || existingMain?.address || ''),
      city: main.city || (existingMain?.city != null ? String(existingMain.city) : undefined),
      state: main.state || (existingMain?.state != null ? String(existingMain.state) : undefined),
    },
    ...osc,
  ]
}

export function resolveCentreFromList(
  list: FirmOutlet[],
  centreId: string | null | undefined,
  fallbackName: string,
): { centreId: string; centreKind: 'main' | 'osc'; centreName: string } {
  const wanted = (centreId || 'main').trim() || 'main'
  const found = list.find((c) => c.id === wanted)
  if (found) {
    return {
      centreId: found.id || 'main',
      centreKind: found.kind === 'osc' ? 'osc' : 'main',
      centreName: String(found.name || fallbackName),
    }
  }
  // Orphaned non-main assignment (e.g. OSC id still on a user after the outlet row was dropped).
  // Keep OSC scope so lab records stay on Main.
  if (wanted !== 'main' && !wanted.startsWith('tn_')) {
    return { centreId: wanted, centreKind: 'osc', centreName: wanted }
  }
  const main = list.find((c) => c.kind === 'main') || list[0]
  return {
    centreId: 'main',
    centreKind: 'main',
    centreName: String(main?.name || fallbackName),
  }
}

export function mergeAssignedOscOutlets(
  outlets: FirmOutlet[],
  assignedCentreIds: Iterable<string | null | undefined>,
): FirmOutlet[] {
  const next = [...outlets]
  const ids = new Set(next.map((c) => c.id))
  for (const raw of assignedCentreIds) {
    const id = String(raw || '').trim()
    if (!id || id === 'main' || ids.has(id) || id.startsWith('tn_')) continue
    next.push({
      id,
      kind: 'osc',
      name: id,
    })
    ids.add(id)
  }
  return next
}

export function filterFirmCentres(
  centres: unknown,
  opts: { centreId: string; centreKind: 'main' | 'osc' },
): unknown[] {
  const list = Array.isArray(centres) ? centres : []
  if (opts.centreKind !== 'osc') return list
  return list.filter((c) => {
    if (!c || typeof c !== 'object') return false
    const rec = c as { id?: string; kind?: string }
    return rec.id === opts.centreId
  })
}

/** Tenant-wide secrets that OSC sessions must not read or overwrite via KV/backup. */
export const TENANT_SECRET_KV_KEYS = ['manak_credentials'] as const

export function isOscRestrictedKvKey(key: string, centreKind: 'main' | 'osc'): boolean {
  if (centreKind !== 'osc') return false
  return (TENANT_SECRET_KV_KEYS as readonly string[]).includes(String(key))
}

export function filterKvForSession(
  docs: Record<string, unknown>,
  centreKind: 'main' | 'osc',
): Record<string, unknown> {
  if (centreKind !== 'osc') return docs
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(docs)) {
    if (isOscRestrictedKvKey(key, centreKind)) continue
    out[key] = value
  }
  return out
}

export function ownTenantPublicView(input: {
  id: string
  slug?: string
  firmName: string
  plan?: string
  status?: string
}): { id: string; slug: string; firmName: string; plan: string; status: string } {
  return {
    id: input.id,
    slug: input.slug || '',
    firmName: input.firmName,
    plan: input.plan || 'trial',
    status: input.status || 'active',
  }
}
