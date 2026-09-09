/**
 * QM / Lab stock ledgers and gold lists.
 * Pages render the UI; fire assay posts consumption through these helpers.
 */
import { tenantGet, tenantSet } from './tenant'
import { store } from './store'

export type StockScope = 'qm' | 'lab'

export type StockKind =
  | 'gold'
  | 'silver'
  | 'copper'
  | 'lead'
  | 'acid'
  | 'cuppels'
  | 'cg-weight'
  | 'bis-gold'
  | 'bis-silver'
  | 'bis-copper'
  | 'bis-lead'
  | 'bis-acid'
  | 'bis-cupels'

export type LedgerEntry = {
  id: string
  date: string
  type: 'In' | 'Out'
  quantity: number
  remarks: string
}

export type GoldWeightEntry = {
  id: string
  date: string
  time: string
  weight: number
}

export type GoldLabEntry = {
  id: string
  date: string
  weight: number
  cornetWeight: number
}

export const GOLD_STOCK_KEY = 'shrija-qm-gold-stock'
export const GOLD_ISSUE_KEY = 'shrija-qm-gold-issues'
export const GOLD_LAB_KEY = 'shrija-qm-gold-lab'
export const LAB_GOLD_CG_KEY = 'shrija-lab-gold-cg'
export const LAB_BIS_GOLD_CG_KEY = 'shrija-lab-bis-gold-cg'
export const BIS_GOLD_ISSUE_KEY = 'shrija-qm-bis-gold-issues'

export function ledgerStorageKey(kind: StockKind, scope: StockScope = 'qm') {
  return `shrija-${scope}-stock-${kind}`
}

export function ledgerUnit(kind: StockKind): string {
  if (kind === 'cuppels' || kind === 'bis-cupels') return 'pcs'
  if (kind === 'acid' || kind === 'bis-acid') return 'ltr'
  if (kind === 'lead' || kind === 'bis-lead') return 'kg'
  return 'g'
}

export function loadLedger(kind: StockKind, scope: StockScope = 'qm'): LedgerEntry[] {
  try {
    const raw = tenantGet(ledgerStorageKey(kind, scope))
    if (!raw) return []
    const parsed = JSON.parse(raw) as LedgerEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLedger(kind: StockKind, entries: LedgerEntry[], scope: StockScope = 'qm') {
  tenantSet(ledgerStorageKey(kind, scope), JSON.stringify(entries))
  const balance = entries.reduce((s, e) => s + (e.type === 'In' ? e.quantity : -e.quantity), 0)
  store.upsertStockByName(
    `${scope.toUpperCase()} ${kind.replace(/-/g, ' ')}`,
    scope === 'lab' ? 'Lab' : 'QM',
    Number(balance.toFixed(3)),
    ledgerUnit(kind),
  )
}

export function ledgerBalance(entries: LedgerEntry[]): number {
  return entries.reduce((s, e) => s + (e.type === 'In' ? e.quantity : -e.quantity), 0)
}

/** Replace or remove a single ledger row by id (fire-assay overwrite-safe). */
export function upsertLedgerOut(
  kind: StockKind,
  scope: StockScope,
  id: string,
  quantity: number,
  date: string,
  remarks: string,
) {
  const next = loadLedger(kind, scope).filter((e) => e.id !== id)
  if (quantity > 0) {
    next.unshift({ id, date, type: 'Out', quantity, remarks })
  }
  saveLedger(kind, next, scope)
}

export function loadGoldList<T>(key: string): T[] {
  try {
    const raw = tenantGet(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveGoldList<T>(key: string, rows: T[]) {
  tenantSet(key, JSON.stringify(rows))
  if (key.includes('gold-stock') || key.includes('gold-lab') || key.includes('bis-gold-stock')) {
    const total = (rows as { weight?: number }[]).reduce((s, r) => s + (Number(r.weight) || 0), 0)
    const location = key.includes('lab') ? 'Lab' : 'QM'
    const label = key.includes('bis') ? 'BIS gold stock' : key.includes('lab') ? 'Lab gold' : 'QM gold stock'
    store.upsertStockByName(label, location, Number(total.toFixed(3)), 'g')
  }
}

export function upsertGoldLabEntry(key: string, row: GoldLabEntry) {
  const next = loadGoldList<GoldLabEntry>(key).filter((r) => r.id !== row.id)
  if ((Number(row.weight) || 0) > 0 || (Number(row.cornetWeight) || 0) > 0) {
    next.unshift(row)
  }
  saveGoldList(key, next)
}
