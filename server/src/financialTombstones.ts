/**
 * Server-side financial tombstones for funds, expenses, and monthly invoices.
 * Mirrors client financialTombstones + invoice accept rules in tenantIsolation.
 *
 * Ownership rule (authoritative):
 * - Client-supplied centreId / centreKind NEVER decide whether a tombstone is accepted.
 * - Acceptance uses the persisted server row for that id (when present).
 * - Main may only create/apply Main-scoped tombstones against Main-owned rows.
 * - OSC may only create/apply tombstones against rows owned by its JWT centreId.
 * - Missing row (already deleted): Main/OSC may still record a tombstone stamped with
 *   their authoritative centre so stale clients cannot resurrect *their* prior row.
 *   Centre-aware apply ensures a Main tombstone never strips an OSC row that later
 *   shares the same id (and vice versa).
 *
 * Note: invoice Main accept still trusts client centre metadata for missing ids —
 * that is a pre-existing separate finding; this module does not copy that flaw into
 * financial apply (centre-aware) or Main accept when a server row exists.
 */

export const FUND_TOMBSTONES_KEY = 'deletedFunds' as const
export const EXPENSE_TOMBSTONES_KEY = 'deletedExpenses' as const
export const MONTHLY_INVOICE_TOMBSTONES_KEY = 'deletedMonthlyInvoices' as const

export const FINANCIAL_TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export type FinancialTombstone = {
  id: string
  centreId: string
  centreKind: 'main' | 'osc'
  deletedAt: string
}

export type FinancialArrayKey = 'funds' | 'expenses' | 'monthlyInvoices'

export const FINANCIAL_ARRAY_TO_TOMBSTONE_KEY: Record<
  FinancialArrayKey,
  typeof FUND_TOMBSTONES_KEY | typeof EXPENSE_TOMBSTONES_KEY | typeof MONTHLY_INVOICE_TOMBSTONES_KEY
> = {
  funds: FUND_TOMBSTONES_KEY,
  expenses: EXPENSE_TOMBSTONES_KEY,
  monthlyInvoices: MONTHLY_INVOICE_TOMBSTONES_KEY,
}

export type CentreScopedItem = {
  centreId?: string
  centreKind?: string
}

function rowId(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const id = (item as { id?: unknown }).id
  return typeof id === 'string' && id.trim() ? id.trim() : ''
}

/** Same ownership heuristic as tenantIsolation.isOscStoreItem (kept local to avoid cycles). */
export function isOscFinancialRow(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const rec = item as CentreScopedItem
  if (String(rec.centreKind || '').toLowerCase() === 'osc') return true
  if (rec.centreId && String(rec.centreId) !== 'main') return true
  return false
}

export function parseFinancialTombstones(value: unknown): FinancialTombstone[] {
  if (!Array.isArray(value)) return []
  const out: FinancialTombstone[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const centreId = typeof rec.centreId === 'string' ? rec.centreId.trim() : ''
    const centreKind = String(rec.centreKind || '').toLowerCase() === 'osc' ? 'osc' : 'main'
    const deletedAt = typeof rec.deletedAt === 'string' ? rec.deletedAt : ''
    out.push({ id, centreId, centreKind, deletedAt })
  }
  return out
}

export function financialTombstoneIsActive(tombstone: FinancialTombstone, now = Date.now()): boolean {
  if (!tombstone.deletedAt) return true
  const ts = Date.parse(tombstone.deletedAt)
  if (!Number.isFinite(ts)) return true
  return now - ts < FINANCIAL_TOMBSTONE_TTL_MS
}

export function unionFinancialTombstones(
  existing: unknown,
  incoming: unknown,
  now = Date.now(),
): FinancialTombstone[] {
  const byId = new Map<string, FinancialTombstone>()
  for (const row of [...parseFinancialTombstones(existing), ...parseFinancialTombstones(incoming)]) {
    if (!financialTombstoneIsActive(row, now)) continue
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

/**
 * Centre-aware apply: a tombstone removes a row only when id matches AND
 * server-authoritative row ownership matches the tombstone's stamped ownership.
 * Client metadata on the *row* is the persisted centre stamp, not the tombstone claim alone.
 */
export function financialTombstoneMatchesRow(
  tombstone: FinancialTombstone,
  item: unknown,
): boolean {
  const id = rowId(item)
  if (!id || id !== tombstone.id) return false
  if (tombstone.centreKind === 'osc') {
    return itemBelongsToCentre(item, tombstone.centreId)
  }
  return !isOscFinancialRow(item)
}

export function applyFinancialTombstones(rows: unknown[], tombstones: FinancialTombstone[]): unknown[] {
  const active = tombstones.filter((row) => financialTombstoneIsActive(row))
  if (active.length === 0) return rows
  return rows.filter((item) => {
    const id = rowId(item)
    if (!id) return true
    return !active.some((tomb) => financialTombstoneMatchesRow(tomb, item))
  })
}

export function itemBelongsToCentre(item: unknown, centreId: string): boolean {
  if (!item || typeof item !== 'object') return false
  const rec = item as CentreScopedItem
  if (rec.centreId) return String(rec.centreId) === centreId
  return false
}

function logFinancialTombstone(
  event: string,
  info: { entity: string; id: string; centreId: string; reason: string },
) {
  console.info(`[financial-tombstone] ${event}`, info)
}

export function acceptOscFinancialTombstones(
  existingRows: unknown[],
  existingTombs: unknown,
  incomingTombs: unknown,
  centreId: string,
  entity: FinancialArrayKey,
): FinancialTombstone[] {
  const accepted: FinancialTombstone[] = []
  for (const row of parseFinancialTombstones(incomingTombs)) {
    // Ignore client centreId when it disagrees with JWT; stamp from session below.
    if (row.centreId && row.centreId !== centreId) {
      logFinancialTombstone('delete-rejected', {
        entity,
        id: row.id,
        centreId,
        reason: 'tombstone-centre-mismatch',
      })
      continue
    }
    const existing = existingRows.find((item) => rowId(item) === row.id)
    if (existing) {
      if (!itemBelongsToCentre(existing, centreId) || !isOscFinancialRow(existing)) {
        logFinancialTombstone('delete-rejected', {
          entity,
          id: row.id,
          centreId,
          reason: 'row-not-owned',
        })
        continue
      }
    }
    // Missing row: allow OSC delete-intent tombstone stamped to JWT centre only.
    accepted.push({
      ...row,
      centreId,
      centreKind: 'osc',
      deletedAt: row.deletedAt || new Date().toISOString(),
    })
  }
  return unionFinancialTombstones(existingTombs, accepted)
}

/**
 * Main acceptance: server row ownership is authoritative.
 * - OSC-owned existing row → reject (even if client claims centreKind/main).
 * - Main-owned existing row → accept, stamp main.
 * - Missing row → accept as main-stamped delete intent (anti-resurrection for Main deletes).
 *   Client centreKind/centreId are ignored for the ownership decision; accepted tombs
 *   are always stamped centreKind:'main'. Centre-aware apply prevents later OSC
 *   same-id collisions from being deleted by that Main tombstone.
 */
export function acceptMainFinancialTombstones(
  existingRows: unknown[],
  existingTombs: unknown,
  incomingTombs: unknown,
  entity: FinancialArrayKey,
): FinancialTombstone[] {
  const existing = parseFinancialTombstones(existingTombs)
  const existingIds = new Set(existing.map((row) => row.id))
  const accepted: FinancialTombstone[] = []
  for (const row of parseFinancialTombstones(incomingTombs)) {
    if (existingIds.has(row.id)) {
      // Keep already-persisted tombstones (union); do not let client rewrite ownership.
      const prior = existing.find((t) => t.id === row.id)!
      accepted.push(prior)
      continue
    }
    const serverRow = existingRows.find((item) => rowId(item) === row.id)
    if (serverRow && isOscFinancialRow(serverRow)) {
      logFinancialTombstone('delete-rejected', {
        entity,
        id: row.id,
        centreId: String((serverRow as CentreScopedItem).centreId || ''),
        reason: 'main-cannot-tombstone-osc-row',
      })
      continue
    }
    // Main-owned or missing: stamp Main. Never persist client-claimed OSC ownership.
    accepted.push({
      id: row.id,
      centreId: 'main',
      centreKind: 'main',
      deletedAt: row.deletedAt || new Date().toISOString(),
    })
  }
  return unionFinancialTombstones(existing, accepted)
}

export function applyFinancialTombstonesToMergedStore(
  merged: Record<string, unknown>,
  arrayKey: FinancialArrayKey,
  tombstones: FinancialTombstone[],
  source: string,
) {
  const tombKey = FINANCIAL_ARRAY_TO_TOMBSTONE_KEY[arrayKey]
  merged[tombKey] = tombstones
  if (!Array.isArray(merged[arrayKey])) return
  const before = merged[arrayKey] as unknown[]
  const after = applyFinancialTombstones(before, tombstones)
  if (after.length !== before.length) {
    const afterSet = new Set(after)
    for (const item of before) {
      if (afterSet.has(item)) continue
      const id = rowId(item)
      if (!id) continue
      const rec = item && typeof item === 'object' ? (item as CentreScopedItem) : {}
      logFinancialTombstone('resurrection-prevented', {
        entity: arrayKey,
        id,
        centreId: String(rec.centreId || ''),
        reason: source,
      })
    }
  }
  merged[arrayKey] = after
}

/**
 * replaceAll restore: snapshot tombstone arrays are authoritative.
 * Drop any tombstone that would delete a row present in the restored array
 * (stale live-only tombstones must not defeat intentional restore).
 */
export function reconcileFinancialTombstonesForReplaceAll(payload: Record<string, unknown>) {
  for (const arrayKey of ['funds', 'expenses', 'monthlyInvoices'] as const) {
    const tombKey = FINANCIAL_ARRAY_TO_TOMBSTONE_KEY[arrayKey]
    const rows = Array.isArray(payload[arrayKey]) ? (payload[arrayKey] as unknown[]) : []
    const reconciled = parseFinancialTombstones(payload[tombKey]).filter((row) => {
      if (!financialTombstoneIsActive(row)) return false
      // Drop tombstone if it would remove any restored row under centre-aware matching.
      return !rows.some((item) => financialTombstoneMatchesRow(row, item))
    })
    payload[tombKey] = reconciled
    if (Array.isArray(payload[arrayKey])) {
      payload[arrayKey] = applyFinancialTombstones(rows, reconciled)
    }
  }
}

export function filterFinancialArraysByTombstones(data: Record<string, unknown>) {
  for (const arrayKey of ['funds', 'expenses', 'monthlyInvoices'] as const) {
    const tombKey = FINANCIAL_ARRAY_TO_TOMBSTONE_KEY[arrayKey]
    const tombs = unionFinancialTombstones(data[tombKey], [])
    data[tombKey] = tombs
    if (Array.isArray(data[arrayKey])) {
      data[arrayKey] = applyFinancialTombstones(data[arrayKey] as unknown[], tombs)
    }
  }
}

export function filterOscFinancialTombstones(
  data: Record<string, unknown>,
  centreId: string,
) {
  for (const key of [FUND_TOMBSTONES_KEY, EXPENSE_TOMBSTONES_KEY, MONTHLY_INVOICE_TOMBSTONES_KEY] as const) {
    const tombs = parseFinancialTombstones(data[key]).filter((row) => row.centreId === centreId)
    data[key] = tombs
  }
}
