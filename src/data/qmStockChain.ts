/**
 * QM / BIS material chain: store receipt → issue to lab → assay usage or return.
 * Units follow hallmarking practice (Ag/Pb g, Cu mg, acid ltr, cupels pcs).
 */
import { tenantGet, tenantSet } from './tenant'
import { store } from './store'
import { loadLedger, type StockKind } from './stockLedger'

export type ChainBook = 'receipt' | 'issue' | 'usage'

export type ChainQtyEntry = {
  id: string
  date: string
  time: string
  weight: number
  size?: string
}

export type ChainThirdStage = 'usage' | 'recovery'

export type ChainSpec = {
  kind: StockKind
  title: string
  subtitle: string
  unit: string
  quantityLabel: string
  step: string
  hasSize: boolean
  sizes: string[]
  sizeLabel: string
  defaultSize: string
  third: ChainThirdStage
  receiptTitle: string
  issueTitle: string
  thirdTitle: string
  availableLabel: string
  labHoldingLabel: string
  usageTotalLabel: string
}

/** Shop cupel blocks — one cavity holds one gold sample. */
export const CUPEL_CAVITIES = ['6', '12', '18', '24']

/** IS 1418:2009 cl. 7.4 — cupel diameter by lead absorption (4 g / 6 g / 10 g). */
export const CUPEL_IS1418_DIAMETERS = ['16', '22', '26']

export function formatCupelSize(size?: string): string {
  if (!size) return '—'
  if (size === '16') return '16 mm · 4 g Pb'
  if (size === '22') return '22 mm · 6 g Pb'
  if (size === '26') return '26 mm · 10 g Pb'
  if (CUPEL_CAVITIES.includes(size)) return `${size} cavities`
  return size
}

function spec(
  kind: StockKind,
  title: string,
  subtitle: string,
  unit: string,
  third: ChainThirdStage,
  thirdTitle: string,
  extra?: Partial<ChainSpec>,
): ChainSpec {
  return {
    kind,
    title,
    subtitle,
    unit,
    quantityLabel: unit === 'ltr' ? 'Volume' : unit === 'pcs' ? 'Quantity' : 'Mass',
    step: unit === 'pcs' ? '1' : unit === 'mg' ? '0.001' : '0.001',
    hasSize: kind === 'cuppels' || kind === 'bis-cupels',
    sizes: kind === 'bis-cupels' ? [...CUPEL_IS1418_DIAMETERS] : CUPEL_CAVITIES,
    sizeLabel: kind === 'bis-cupels' ? 'Diameter' : 'Cavities',
    defaultSize: kind === 'bis-cupels' ? '16' : '6',
    third,
    receiptTitle: 'Stock receipt',
    issueTitle: 'Issue to lab',
    thirdTitle,
    availableLabel: 'Available',
    labHoldingLabel: 'Lab holding',
    usageTotalLabel: third === 'recovery' ? 'Total returned' : 'Total used in assay',
    ...extra,
  }
}

const SPECS: Partial<Record<StockKind, ChainSpec>> = {
  silver: spec('silver', 'Silver', 'Store receipt, lab issue, and post-assay return', 'g', 'recovery', 'Returned from lab'),
  copper: spec('copper', 'Copper', 'Store receipt, lab issue, and assay usage', 'mg', 'usage', 'Assay consumption'),
  lead: spec('lead', 'Lead', 'Store receipt, lab issue, and assay usage', 'g', 'usage', 'Assay consumption'),
  acid: spec('acid', 'Acid', 'Store receipt, lab issue, and assay usage', 'ltr', 'usage', 'Assay consumption'),
  cuppels: spec('cuppels', 'Cupels', 'Store receipt, lab issue, and assay usage', 'pcs', 'usage', 'Cupels consumed'),
  'bis-silver': spec(
    'bis-silver',
    'Silver (BIS)',
    'BIS register · receipt, lab issue, and post-assay return',
    'g',
    'recovery',
    'Post-assay return',
  ),
  'bis-copper': spec(
    'bis-copper',
    'Copper (BIS)',
    'BIS register · receipt, lab issue, and assay usage',
    'mg',
    'usage',
    'Assay consumption',
  ),
  'bis-lead': spec(
    'bis-lead',
    'Lead (BIS)',
    'BIS register · receipt, lab issue, and assay usage',
    'g',
    'usage',
    'Assay consumption',
  ),
  'bis-acid': spec(
    'bis-acid',
    'Acid (BIS)',
    'IS 1418 parting acid · receipt, lab issue, and assay usage',
    'ltr',
    'usage',
    'Assay consumption',
  ),
  'bis-cupels': spec(
    'bis-cupels',
    'Cupels (BIS)',
    'IS 1418 · 16 / 22 / 26 mm by lead absorption (blocks of like absorbance)',
    'pcs',
    'usage',
    'Cupels consumed',
  ),
}

export function getChainSpec(kind: StockKind): ChainSpec | null {
  return SPECS[kind] || null
}

export function chainStorageKey(kind: StockKind, book: ChainBook) {
  return `shrija-qm-chain-${kind}-${book}`
}

export function loadChain(kind: StockKind, book: ChainBook): ChainQtyEntry[] {
  try {
    const raw = tenantGet(chainStorageKey(kind, book))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChainQtyEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveChain(kind: StockKind, book: ChainBook, rows: ChainQtyEntry[]) {
  tenantSet(chainStorageKey(kind, book), JSON.stringify(rows))
  const spec = getChainSpec(kind)
  if (!spec) return
  const receipt = book === 'receipt' ? rows : loadChain(kind, 'receipt')
  const issue = book === 'issue' ? rows : loadChain(kind, 'issue')
  const available = sumWeights(receipt) - sumWeights(issue)
  store.upsertStockByName(
    `QM ${kind.replace(/-/g, ' ')}`,
    'QM',
    Number(available.toFixed(3)),
    spec.unit,
  )
}

export function sumWeights(rows: ChainQtyEntry[]): number {
  return rows.reduce((s, r) => s + (Number(r.weight) || 0), 0)
}

export function upsertChainUsage(
  kind: StockKind,
  id: string,
  date: string,
  weight: number,
  size?: string,
) {
  if (!getChainSpec(kind)) return
  const next = loadChain(kind, 'usage').filter((r) => r.id !== id)
  if (weight > 0) {
    const prev = loadChain(kind, 'usage').find((r) => r.id === id)
    next.unshift({
      id,
      date,
      time: prev?.time || nowTime(),
      weight,
      size: size || prev?.size,
    })
  }
  saveChain(kind, 'usage', next)
}

function nowTime() {
  return new Date().toTimeString().slice(0, 8)
}

function ledgerQtyToChain(kind: StockKind, quantity: number): number {
  if (kind === 'copper' || kind === 'bis-copper') return Number((quantity * 1000).toFixed(3))
  if (kind === 'lead' || kind === 'bis-lead') return Number((quantity * 1000).toFixed(3))
  return quantity
}

/** One-time: old In/Out ledger → receipt / issue / usage. */
export function migrateLedgerIntoChain(kind: StockKind) {
  const receipt = loadChain(kind, 'receipt')
  const issue = loadChain(kind, 'issue')
  const usage = loadChain(kind, 'usage')
  if (receipt.length || issue.length || usage.length) return
  const ledger = loadLedger(kind, 'qm')
  if (!ledger.length) return
  const receipts: ChainQtyEntry[] = []
  const issues: ChainQtyEntry[] = []
  const usages: ChainQtyEntry[] = []
  for (const e of ledger) {
    const row: ChainQtyEntry = {
      id: e.id,
      date: e.date,
      time: '00:00:00',
      weight: ledgerQtyToChain(kind, e.quantity),
    }
    if (e.type === 'In') receipts.push(row)
    else if (String(e.id).startsWith('fa-')) usages.push(row)
    else issues.push(row)
  }
  if (receipts.length) saveChain(kind, 'receipt', receipts)
  if (issues.length) saveChain(kind, 'issue', issues)
  if (usages.length) saveChain(kind, 'usage', usages)
}
