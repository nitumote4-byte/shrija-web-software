/**
 * Browser-local durable deletion intent for invoice tombstones.
 *
 * The server store PUT remains the only persistence path. This layer exists so
 * an F5 during an in-flight PUT cannot drop a tombstone that existed only in
 * memory. localStorage is not trusted: records are tenant/centre scoped, and
 * the server still runs acceptOscInvoiceTombstones / acceptMainInvoiceTombstones.
 *
 * Pending records are not expired here. Once flushed into the store, the
 * existing 90-day tombstone TTL (INVOICE_TOMBSTONE_TTL_MS) applies.
 */
import {
  INVOICE_TOMBSTONES_KEY,
  applyInvoiceTombstones,
  parseInvoiceTombstones,
  unionInvoiceTombstones,
  type CentreActor,
  type InvoiceTombstone,
} from './invoiceTombstones'

function unionPendingTombstones(existing: InvoiceTombstone[], incoming: InvoiceTombstone[]): InvoiceTombstone[] {
  const byId = new Map<string, InvoiceTombstone>()
  for (const row of [...existing, ...incoming]) {
    if (!row.id || byId.has(row.id)) continue
    byId.set(row.id, row)
  }
  return [...byId.values()]
}

export const PENDING_INVOICE_TOMBSTONES_VERSION = 1 as const

export const PENDING_INVOICE_TOMBSTONES_KEY_PREFIX = 'shrija-pending-invoice-tombstones:v1' as const

export type PendingTombstoneScope = CentreActor & {
  tenantId: string
}

export type PendingInvoiceTombstoneRecord = {
  version: typeof PENDING_INVOICE_TOMBSTONES_VERSION
  tenantId: string
  centreId: string
  tombstones: InvoiceTombstone[]
}

export type PendingTombstoneStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type StoreShape = Record<string, unknown>

let storageOverride: PendingTombstoneStorage | null = null

export function pendingInvoiceTombstonesStorageKey(scope: Pick<PendingTombstoneScope, 'tenantId' | 'centreId'>): string {
  return `${PENDING_INVOICE_TOMBSTONES_KEY_PREFIX}:${scope.tenantId}:${scope.centreId}`
}

/** Test-only. Pass null to restore localStorage. */
export function setPendingInvoiceTombstoneStorageForTests(storage: PendingTombstoneStorage | null) {
  storageOverride = storage
}

function getStorage(): PendingTombstoneStorage | null {
  if (storageOverride) return storageOverride
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function warnStorageUnavailable() {
  console.warn('[invoice-tombstone] pending-storage-unavailable')
}

export function pendingTombstoneMatchesScope(
  tombstone: InvoiceTombstone,
  scope: PendingTombstoneScope,
): boolean {
  if (!tombstone.id || !scope.centreId) return false
  if (scope.centreKind === 'osc') {
    return tombstone.centreKind === 'osc' && tombstone.centreId === scope.centreId
  }
  if (tombstone.centreKind === 'osc') return false
  return !tombstone.centreId || tombstone.centreId === 'main' || tombstone.centreId === scope.centreId
}

function parsePendingRecord(raw: unknown, scope: PendingTombstoneScope): InvoiceTombstone[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const rec = raw as Record<string, unknown>
  if (rec.version !== PENDING_INVOICE_TOMBSTONES_VERSION) return []
  if (typeof rec.tenantId !== 'string' || rec.tenantId !== scope.tenantId) return []
  if (typeof rec.centreId !== 'string' || rec.centreId !== scope.centreId) return []
  return parseInvoiceTombstones(rec.tombstones).filter((row) => pendingTombstoneMatchesScope(row, scope))
}

function readRecord(scope: PendingTombstoneScope): InvoiceTombstone[] {
  const storage = getStorage()
  if (!storage) return []
  let raw: string | null = null
  try {
    raw = storage.getItem(pendingInvoiceTombstonesStorageKey(scope))
  } catch {
    warnStorageUnavailable()
    return []
  }
  if (!raw) return []
  try {
    return parsePendingRecord(JSON.parse(raw), scope)
  } catch {
    return []
  }
}

function writeRecord(scope: PendingTombstoneScope, tombstones: InvoiceTombstone[]): boolean {
  const storage = getStorage()
  if (!storage) {
    warnStorageUnavailable()
    return false
  }
  const key = pendingInvoiceTombstonesStorageKey(scope)
  try {
    if (tombstones.length === 0) {
      storage.removeItem(key)
      return true
    }
    const record: PendingInvoiceTombstoneRecord = {
      version: PENDING_INVOICE_TOMBSTONES_VERSION,
      tenantId: scope.tenantId,
      centreId: scope.centreId,
      tombstones,
    }
    storage.setItem(key, JSON.stringify(record))
    return true
  } catch {
    warnStorageUnavailable()
    return false
  }
}

export function readPendingInvoiceTombstones(scope: PendingTombstoneScope): InvoiceTombstone[] {
  if (!scope.tenantId || !scope.centreId) return []
  return readRecord(scope)
}

/** Persist deletion intent for this tenant/centre. Does not trust invoice-id-only matches. */
export function rememberPendingInvoiceTombstone(
  scope: PendingTombstoneScope,
  tombstone: InvoiceTombstone,
): boolean {
  if (!scope.tenantId || !scope.centreId) return false
  if (!pendingTombstoneMatchesScope(tombstone, scope)) return false
  const next = unionPendingTombstones(readRecord(scope), [tombstone])
  return writeRecord(scope, next)
}

export function clearPendingInvoiceTombstones(scope: PendingTombstoneScope, ids: Iterable<string>): boolean {
  if (!scope.tenantId || !scope.centreId) return false
  const remove = new Set([...ids].filter(Boolean))
  if (remove.size === 0) return true
  const kept = readRecord(scope).filter((row) => !remove.has(row.id))
  return writeRecord(scope, kept)
}

export function clearAllPendingInvoiceTombstones(scope: PendingTombstoneScope): boolean {
  if (!scope.tenantId || !scope.centreId) return false
  return writeRecord(scope, [])
}

export function applyPendingInvoiceTombstonesToStore<T extends StoreShape>(
  store: T,
  scope: PendingTombstoneScope,
): { store: T; applied: InvoiceTombstone[] } {
  const applied = readPendingInvoiceTombstones(scope)
  if (applied.length === 0) return { store, applied }
  const tombstones = unionInvoiceTombstones(store[INVOICE_TOMBSTONES_KEY], applied)
  const invoices = Array.isArray(store.invoices)
    ? applyInvoiceTombstones(store.invoices as unknown[], tombstones)
    : store.invoices
  return {
    store: {
      ...store,
      [INVOICE_TOMBSTONES_KEY]: tombstones,
      invoices,
    },
    applied,
  }
}
