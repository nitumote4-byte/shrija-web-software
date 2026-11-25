/**
 * Non-admins may add new operational rows (request, bill, payment, expense,
 * party, assay). They may not change or delete a saved bill, payment,
 * expense, party, or rate. Admin permission is isAdmin / the Admin role,
 * not the Quality Manager role by itself.
 *
 * Payment status on hallmarking invoices is derived from funds, so a new
 * payment may update invoice status and updatedAt without counting as an edit.
 */
import { applyNotifiedHallmarkingRate } from './hallmarkingRates.js'
import {
  ensureOtherServiceTypes,
  sanitizeOtherServicesStorePayload,
  type OtherServiceType,
} from './otherServices.js'

export const RECORD_LOCK_VIOLATION = 'RECORD_LOCK_VIOLATION' as const

export const RECORD_LOCK_MESSAGE =
  'Only an admin can change or delete saved bills, payments, expenses, parties, or rates.'

export type RecordLockResult =
  | { ok: true }
  | { ok: false; status: 403; error: string; code: typeof RECORD_LOCK_VIOLATION }

const LOCKED_ARRAYS = [
  'invoices',
  'monthlyInvoices',
  'funds',
  'expenses',
  'parties',
  'purchaseParties',
  'categories',
  'otherServiceTypes',
] as const

/** New rows are allowed on these keys. Service-type rates are a master list. */
const NO_NEW_ROWS = new Set<string>(['otherServiceTypes'])

const TOMBSTONE_ARRAYS = [
  'deletedInvoices',
  'deletedFunds',
  'deletedExpenses',
  'deletedMonthlyInvoices',
] as const

/** Fields a new payment, or the server, may refresh without an admin edit. */
const VOLATILE_FIELDS: Record<string, readonly string[]> = {
  invoices: ['status', 'updatedAt'],
  monthlyInvoices: ['updatedAt'],
  expenses: ['updatedAt'],
  parties: ['updatedAt'],
  purchaseParties: ['updatedAt'],
  otherServiceTypes: ['updatedAt', 'createdAt', 'createdBy', 'updatedBy'],
  categories: ['updatedAt'],
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function rowId(row: Record<string, unknown>): string {
  return String(row.id || '').trim()
}

function indexRows(value: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(value)) return map
  for (const raw of value) {
    const row = asRecord(raw)
    if (!row) continue
    const id = rowId(row)
    if (id) map.set(id, row)
  }
  return map
}

function stable(value: unknown, ignore: ReadonlySet<string> | null): unknown {
  if (Array.isArray(value)) return value.map((item) => stable(item, null))
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(src).sort()) {
      if (ignore?.has(key)) continue
      const child = src[key]
      if (child === undefined || child === null) continue
      out[key] = stable(child, null)
    }
    return out
  }
  return value
}

function sameRow(prev: Record<string, unknown>, next: Record<string, unknown>, ignore: readonly string[]) {
  const skip = new Set(ignore)
  return JSON.stringify(stable(prev, skip)) === JSON.stringify(stable(next, skip))
}

function normalizeCategoryRates(store: Record<string, unknown>) {
  if (!Array.isArray(store.categories)) return
  store.categories = store.categories.map((raw) => {
    const row = asRecord(raw)
    if (!row) return raw
    if (typeof row.metal !== 'string' || typeof row.rate !== 'number' || !Number.isFinite(row.rate)) {
      return raw
    }
    return applyNotifiedHallmarkingRate(row as { metal: string; rate: number })
  })
}

function tombstoneIds(value: unknown): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(value)) return ids
  for (const raw of value) {
    const row = asRecord(raw)
    if (!row) continue
    const id = rowId(row)
    if (id) ids.add(id)
  }
  return ids
}

function rowsFor(key: string, store: Record<string, unknown>): unknown {
  if (key === 'otherServiceTypes') {
    const raw = Array.isArray(store.otherServiceTypes) ? store.otherServiceTypes : []
    return ensureOtherServiceTypes(raw as OtherServiceType[])
  }
  return store[key]
}

function lockArrays(
  currentStore: Record<string, unknown>,
  nextStore: Record<string, unknown>,
): RecordLockResult {
  for (const key of LOCKED_ARRAYS) {
    if (!Object.prototype.hasOwnProperty.call(nextStore, key)) continue
    const current = indexRows(rowsFor(key, currentStore))
    const next = indexRows(rowsFor(key, nextStore))
    const ignore = VOLATILE_FIELDS[key] || []

    for (const [id, prev] of current) {
      const row = next.get(id)
      if (!row) {
        return { ok: false, status: 403, error: RECORD_LOCK_MESSAGE, code: RECORD_LOCK_VIOLATION }
      }
      if (!sameRow(prev, row, ignore)) {
        return { ok: false, status: 403, error: RECORD_LOCK_MESSAGE, code: RECORD_LOCK_VIOLATION }
      }
    }

    if (NO_NEW_ROWS.has(key)) {
      for (const id of next.keys()) {
        if (!current.has(id)) {
          return { ok: false, status: 403, error: RECORD_LOCK_MESSAGE, code: RECORD_LOCK_VIOLATION }
        }
      }
    }
  }

  for (const key of TOMBSTONE_ARRAYS) {
    if (!Object.prototype.hasOwnProperty.call(nextStore, key)) continue
    const current = tombstoneIds(currentStore[key])
    for (const id of tombstoneIds(nextStore[key])) {
      if (!current.has(id)) {
        return { ok: false, status: 403, error: RECORD_LOCK_MESSAGE, code: RECORD_LOCK_VIOLATION }
      }
    }
  }

  return { ok: true }
}

export function enforceLockedRecordMutations(opts: {
  currentStore: Record<string, unknown>
  nextStore: Record<string, unknown>
  isAdmin: boolean
  replaceAll?: boolean
}): RecordLockResult {
  if (opts.isAdmin || opts.replaceAll) return { ok: true }

  const currentView = structuredClone(opts.currentStore)
  sanitizeOtherServicesStorePayload(currentView)
  normalizeCategoryRates(currentView)

  sanitizeOtherServicesStorePayload(opts.nextStore)
  normalizeCategoryRates(opts.nextStore)

  return lockArrays(currentView, opts.nextStore)
}
