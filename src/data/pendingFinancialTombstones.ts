/**
 * Browser-local durable deletion intent for funds / expenses / monthly invoices.
 *
 * Parallel to pendingInvoiceTombstones — kept separate so invoice pending
 * storage remains compatible. Server acceptance remains authoritative.
 */
import {
  ENTITY_TO_TOMBSTONE_KEY,
  EXPENSE_TOMBSTONES_KEY,
  FUND_TOMBSTONES_KEY,
  MONTHLY_INVOICE_TOMBSTONES_KEY,
  applyFinancialTombstones,
  financialTombstoneIds,
  parseFinancialTombstones,
  unionFinancialTombstones,
  type FinancialTombstone,
  type FinancialTombstoneEntity,
} from './financialTombstones'
import type { CentreActor } from './invoiceTombstones'

export type PendingFinancialTombstoneScope = CentreActor & {
  tenantId: string
}

export type PendingFinancialEntry = FinancialTombstone & {
  entity: FinancialTombstoneEntity
}

export const PENDING_FINANCIAL_TOMBSTONES_VERSION = 1 as const
export const PENDING_FINANCIAL_TOMBSTONES_KEY_PREFIX = 'shrija-pending-financial-tombstones:v1' as const

export type PendingFinancialTombstoneRecord = {
  version: typeof PENDING_FINANCIAL_TOMBSTONES_VERSION
  tenantId: string
  centreId: string
  tombstones: PendingFinancialEntry[]
}

export type PendingFinancialTombstoneStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type StoreShape = Record<string, unknown>

let storageOverride: PendingFinancialTombstoneStorage | null = null

export function pendingFinancialTombstonesStorageKey(
  scope: Pick<PendingFinancialTombstoneScope, 'tenantId' | 'centreId'>,
): string {
  return `${PENDING_FINANCIAL_TOMBSTONES_KEY_PREFIX}:${scope.tenantId}:${scope.centreId}`
}

/** Test-only. Pass null to restore localStorage. */
export function setPendingFinancialTombstoneStorageForTests(
  storage: PendingFinancialTombstoneStorage | null,
) {
  storageOverride = storage
}

function getStorage(): PendingFinancialTombstoneStorage | null {
  if (storageOverride) return storageOverride
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function warnStorageUnavailable() {
  console.warn('[financial-tombstone] pending-storage-unavailable')
}

export function pendingFinancialTombstoneMatchesScope(
  tombstone: FinancialTombstone,
  scope: PendingFinancialTombstoneScope,
): boolean {
  if (!tombstone.id || !scope.centreId) return false
  if (scope.centreKind === 'osc') {
    return tombstone.centreKind === 'osc' && tombstone.centreId === scope.centreId
  }
  if (tombstone.centreKind === 'osc') return false
  return !tombstone.centreId || tombstone.centreId === 'main' || tombstone.centreId === scope.centreId
}

function entryKey(row: PendingFinancialEntry): string {
  return `${row.entity}:${row.id}`
}

function unionPendingEntries(
  existing: PendingFinancialEntry[],
  incoming: PendingFinancialEntry[],
): PendingFinancialEntry[] {
  const byKey = new Map<string, PendingFinancialEntry>()
  for (const row of [...existing, ...incoming]) {
    if (!row.id || !row.entity) continue
    const key = entryKey(row)
    if (byKey.has(key)) continue
    byKey.set(key, row)
  }
  return [...byKey.values()]
}

function parsePendingRecord(raw: unknown, scope: PendingFinancialTombstoneScope): PendingFinancialEntry[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const rec = raw as Record<string, unknown>
  if (rec.version !== PENDING_FINANCIAL_TOMBSTONES_VERSION) return []
  if (typeof rec.tenantId !== 'string' || rec.tenantId !== scope.tenantId) return []
  if (typeof rec.centreId !== 'string' || rec.centreId !== scope.centreId) return []
  if (!Array.isArray(rec.tombstones)) return []
  const out: PendingFinancialEntry[] = []
  for (const item of rec.tombstones) {
    if (!item || typeof item !== 'object') continue
    const entity = (item as { entity?: unknown }).entity
    if (entity !== 'funds' && entity !== 'expenses' && entity !== 'monthlyInvoices') continue
    const parsed = parseFinancialTombstones([item])[0]
    if (!parsed) continue
    if (!pendingFinancialTombstoneMatchesScope(parsed, scope)) continue
    out.push({ ...parsed, entity })
  }
  return out
}

function readRecord(scope: PendingFinancialTombstoneScope): PendingFinancialEntry[] {
  const storage = getStorage()
  if (!storage) return []
  let raw: string | null = null
  try {
    raw = storage.getItem(pendingFinancialTombstonesStorageKey(scope))
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

function writeRecord(scope: PendingFinancialTombstoneScope, tombstones: PendingFinancialEntry[]): boolean {
  const storage = getStorage()
  if (!storage) {
    warnStorageUnavailable()
    return false
  }
  const key = pendingFinancialTombstonesStorageKey(scope)
  try {
    if (tombstones.length === 0) {
      storage.removeItem(key)
      return true
    }
    const record: PendingFinancialTombstoneRecord = {
      version: PENDING_FINANCIAL_TOMBSTONES_VERSION,
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

export function readPendingFinancialTombstones(scope: PendingFinancialTombstoneScope): PendingFinancialEntry[] {
  if (!scope.tenantId || !scope.centreId) return []
  return readRecord(scope)
}

export function rememberPendingFinancialTombstone(
  scope: PendingFinancialTombstoneScope,
  entity: FinancialTombstoneEntity,
  tombstone: FinancialTombstone,
): boolean {
  if (!scope.tenantId || !scope.centreId) return false
  if (!pendingFinancialTombstoneMatchesScope(tombstone, scope)) return false
  const next = unionPendingEntries(readRecord(scope), [{ ...tombstone, entity }])
  return writeRecord(scope, next)
}

export function clearPendingFinancialTombstones(
  scope: PendingFinancialTombstoneScope,
  entity: FinancialTombstoneEntity,
  ids: Iterable<string>,
): boolean {
  if (!scope.tenantId || !scope.centreId) return false
  const remove = new Set([...ids].filter(Boolean))
  if (remove.size === 0) return true
  const kept = readRecord(scope).filter((row) => !(row.entity === entity && remove.has(row.id)))
  return writeRecord(scope, kept)
}

export function clearAllPendingFinancialTombstones(scope: PendingFinancialTombstoneScope): boolean {
  if (!scope.tenantId || !scope.centreId) return false
  return writeRecord(scope, [])
}

export function clearConfirmedPendingFinancialTombstones(
  scope: PendingFinancialTombstoneScope,
  store: StoreShape,
): boolean {
  if (!scope.tenantId || !scope.centreId) return false
  const confirmed = new Set<string>()
  for (const entity of ['funds', 'expenses', 'monthlyInvoices'] as const) {
    const key = ENTITY_TO_TOMBSTONE_KEY[entity]
    for (const id of financialTombstoneIds(store[key])) {
      confirmed.add(`${entity}:${id}`)
    }
  }
  if (confirmed.size === 0) return true
  const kept = readRecord(scope).filter((row) => !confirmed.has(entryKey(row)))
  return writeRecord(scope, kept)
}

export function applyPendingFinancialTombstonesToStore<T extends StoreShape>(
  store: T,
  scope: PendingFinancialTombstoneScope,
): { store: T; applied: PendingFinancialEntry[] } {
  const applied = readPendingFinancialTombstones(scope)
  if (applied.length === 0) return { store, applied }

  const byEntity: Record<FinancialTombstoneEntity, FinancialTombstone[]> = {
    funds: [],
    expenses: [],
    monthlyInvoices: [],
  }
  for (const row of applied) {
    byEntity[row.entity].push(row)
  }

  const fundsTombs = unionFinancialTombstones(store[FUND_TOMBSTONES_KEY], byEntity.funds)
  const expenseTombs = unionFinancialTombstones(store[EXPENSE_TOMBSTONES_KEY], byEntity.expenses)
  const monthlyTombs = unionFinancialTombstones(
    store[MONTHLY_INVOICE_TOMBSTONES_KEY],
    byEntity.monthlyInvoices,
  )

  return {
    store: {
      ...store,
      [FUND_TOMBSTONES_KEY]: fundsTombs,
      [EXPENSE_TOMBSTONES_KEY]: expenseTombs,
      [MONTHLY_INVOICE_TOMBSTONES_KEY]: monthlyTombs,
      funds: Array.isArray(store.funds)
        ? applyFinancialTombstones(store.funds as unknown[], fundsTombs)
        : store.funds,
      expenses: Array.isArray(store.expenses)
        ? applyFinancialTombstones(store.expenses as unknown[], expenseTombs)
        : store.expenses,
      monthlyInvoices: Array.isArray(store.monthlyInvoices)
        ? applyFinancialTombstones(store.monthlyInvoices as unknown[], monthlyTombs)
        : store.monthlyInvoices,
    },
    applied,
  }
}
