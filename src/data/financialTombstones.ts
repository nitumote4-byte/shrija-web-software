/**
 * Explicit deletion records for funds, expenses, and monthly invoices.
 * Array absence alone is not enough: 409 unions and Main/OSC merges would
 * otherwise resurrect deleted financial rows. Tombstones live in the same
 * store JSON (same pattern as deletedInvoices).
 *
 * Cleanup: tombstones older than FINANCIAL_TOMBSTONE_TTL_MS are dropped during
 * union. Stale clients older than that window could theoretically resurrect;
 * that is accepted to bound unbounded growth (matches invoice tombstones).
 */

import type { CentreActor } from './invoiceTombstones'
import { canDeleteInvoiceForCentre, isOscCentreMeta } from './invoiceTombstones'

export const FUND_TOMBSTONES_KEY = 'deletedFunds' as const
export const EXPENSE_TOMBSTONES_KEY = 'deletedExpenses' as const
export const MONTHLY_INVOICE_TOMBSTONES_KEY = 'deletedMonthlyInvoices' as const

export const FINANCIAL_TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export type FinancialTombstoneEntity = 'funds' | 'expenses' | 'monthlyInvoices'

export type FinancialTombstone = {
  id: string
  centreId: string
  centreKind: 'main' | 'osc'
  deletedAt: string
}

export const FINANCIAL_TOMBSTONE_KEYS = [
  FUND_TOMBSTONES_KEY,
  EXPENSE_TOMBSTONES_KEY,
  MONTHLY_INVOICE_TOMBSTONES_KEY,
] as const

export type FinancialTombstoneKey = (typeof FINANCIAL_TOMBSTONE_KEYS)[number]

export const ENTITY_TO_TOMBSTONE_KEY: Record<FinancialTombstoneEntity, FinancialTombstoneKey> = {
  funds: FUND_TOMBSTONES_KEY,
  expenses: EXPENSE_TOMBSTONES_KEY,
  monthlyInvoices: MONTHLY_INVOICE_TOMBSTONES_KEY,
}

export const TOMBSTONE_KEY_TO_ENTITY: Record<FinancialTombstoneKey, FinancialTombstoneEntity> = {
  [FUND_TOMBSTONES_KEY]: 'funds',
  [EXPENSE_TOMBSTONES_KEY]: 'expenses',
  [MONTHLY_INVOICE_TOMBSTONES_KEY]: 'monthlyInvoices',
}

type CentreMeta = {
  centreId?: string
  centreKind?: string
}

function rowId(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const id = (item as { id?: unknown }).id
  return typeof id === 'string' && id.trim() ? id.trim() : ''
}

/** Same ownership rules as invoice deletes: OSC own centre only; Main owns non-OSC rows. */
export function canDeleteFinancialRowForCentre(
  row: CentreMeta | null | undefined,
  actor: CentreActor | null | undefined,
): boolean {
  return canDeleteInvoiceForCentre(row, actor)
}

export function makeFinancialTombstone(
  row: { id: string } & CentreMeta,
  actor: CentreActor,
  deletedAt = new Date().toISOString(),
): FinancialTombstone {
  return {
    id: row.id,
    centreId: actor.centreKind === 'osc' ? actor.centreId : row.centreId || actor.centreId || 'main',
    centreKind: actor.centreKind === 'osc' ? 'osc' : 'main',
    deletedAt,
  }
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

/** True when persisted row ownership is OSC (matches server isOscFinancialRow). */
function isOscOwnedRow(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const rec = item as CentreMeta
  if (String(rec.centreKind || '').toLowerCase() === 'osc') return true
  if (rec.centreId && rec.centreId !== 'main') return true
  return false
}

function tombstoneMatchesRow(tombstone: FinancialTombstone, item: unknown): boolean {
  const id = rowId(item)
  if (!id || id !== tombstone.id) return false
  if (tombstone.centreKind === 'osc') {
    return String((item as CentreMeta)?.centreId || '') === tombstone.centreId
  }
  return !isOscOwnedRow(item)
}

/**
 * Centre-aware apply: Main tombstones only remove Main-owned rows; OSC tombstones
 * only remove that OSC's rows. Same-id Main+OSC collisions cannot cross-delete.
 */
export function applyFinancialTombstones<T>(rows: T[], tombstones: unknown): T[] {
  const active = parseFinancialTombstones(tombstones).filter((row) => financialTombstoneIsActive(row))
  if (active.length === 0) return rows
  return rows.filter((item) => {
    const id = rowId(item)
    if (!id) return true
    return !active.some((tomb) => tombstoneMatchesRow(tomb, item))
  })
}

export function financialTombstoneIds(tombstones: unknown): Set<string> {
  return new Set(
    parseFinancialTombstones(tombstones)
      .filter((row) => financialTombstoneIsActive(row))
      .map((row) => row.id),
  )
}

/** After replaceAll restore: drop tombstones that would delete rows present in the snapshot. */
export function reconcileTombstonesWithRestoredRows(
  tombstones: unknown,
  restoredRows: unknown,
): FinancialTombstone[] {
  const rows = Array.isArray(restoredRows) ? restoredRows : []
  return parseFinancialTombstones(tombstones).filter((row) => {
    if (!financialTombstoneIsActive(row)) return false
    return !rows.some((item) => tombstoneMatchesRow(row, item))
  })
}

export function isOscFinancialMeta(meta?: CentreMeta | null): boolean {
  return isOscCentreMeta(meta)
}
