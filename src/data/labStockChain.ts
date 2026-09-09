/**
 * Lab / BIS lab books: inbound is QM "Issue to lab".
 * Prepared / in-assay / used / recovered live on the lab side.
 */
import { tenantGet, tenantSet } from './tenant'
import { store } from './store'
import { loadLedger, type StockKind } from './stockLedger'
import { getChainSpec, loadChain, sumWeights, CUPEL_CAVITIES, type ChainQtyEntry } from './qmStockChain'

export type LabBook = 'ready' | 'used' | 'process' | 'recovered'
export type LabLayout = 'prepared-used' | 'used-only' | 'silver'

export type LabSpec = {
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
  layout: LabLayout
  inboundTitle: string
  preparedTitle: string
  usedTitle: string
  processTitle: string
  recoveredTitle: string
  onHandLabel: string
  usedTotalLabel: string
}

function spec(
  kind: StockKind,
  title: string,
  subtitle: string,
  unit: string,
  layout: LabLayout,
  extra?: Partial<LabSpec>,
): LabSpec {
  const chain = getChainSpec(kind)
  return {
    kind,
    title,
    subtitle,
    unit,
    quantityLabel: chain?.quantityLabel || (unit === 'ltr' ? 'Volume' : unit === 'pcs' ? 'Quantity' : 'Mass'),
    step: chain?.step || '0.001',
    hasSize: kind === 'cuppels' || kind === 'bis-cupels',
    sizes: chain?.sizes || CUPEL_CAVITIES,
    sizeLabel: chain?.sizeLabel || 'Cavities',
    defaultSize: chain?.defaultSize || '6',
    layout,
    inboundTitle: 'Received from store',
    preparedTitle: unit === 'mg' ? 'Prepared rolls' : 'Prepared for assay',
    usedTitle: 'Assay consumption',
    processTitle: 'In assay',
    recoveredTitle: 'Recovered rinse',
    onHandLabel: 'Lab on-hand',
    usedTotalLabel: layout === 'silver' ? 'Total in assay' : 'Total used in assay',
    ...extra,
  }
}

const SPECS: Partial<Record<StockKind, LabSpec>> = {
  silver: spec('silver', 'Silver', 'Received from store, in assay, prepared balls, recovered rinse', 'g', 'silver', {
    preparedTitle: 'Prepared balls',
  }),
  copper: spec('copper', 'Copper', 'Received from store, prepared rolls, assay usage', 'mg', 'prepared-used'),
  lead: spec('lead', 'Lead', 'Received from store, prepared charge, assay usage', 'g', 'prepared-used', {
    preparedTitle: 'Prepared charge',
  }),
  acid: spec('acid', 'Acid', 'Received from store and assay usage', 'ltr', 'used-only'),
  cuppels: spec('cuppels', 'Cupels', 'Received from store and assay usage', 'pcs', 'used-only'),
  'bis-silver': spec(
    'bis-silver',
    'Silver (BIS)',
    'BIS lab register · store transfer, in assay, prepared balls, recovered rinse',
    'g',
    'silver',
    { preparedTitle: 'Prepared balls' },
  ),
  'bis-copper': spec(
    'bis-copper',
    'Copper (BIS)',
    'BIS lab register · store transfer, prepared rolls, assay usage',
    'mg',
    'prepared-used',
  ),
  'bis-lead': spec(
    'bis-lead',
    'Lead (BIS)',
    'BIS lab register · store transfer, prepared charge, assay usage',
    'g',
    'prepared-used',
    { preparedTitle: 'Prepared charge' },
  ),
  'bis-acid': spec(
    'bis-acid',
    'Acid (BIS)',
    'IS 1418 parting acid · store transfer and assay usage',
    'ltr',
    'used-only',
  ),
  'bis-cupels': spec(
    'bis-cupels',
    'Cupels (BIS)',
    'IS 1418 · 16 / 22 / 26 mm by lead absorption (blocks of like absorbance)',
    'pcs',
    'used-only',
  ),
}

export function getLabSpec(kind: StockKind): LabSpec | null {
  return SPECS[kind] || null
}

export function labStorageKey(kind: StockKind, book: LabBook) {
  return `shrija-lab-chain-${kind}-${book}`
}

export function loadLabChain(kind: StockKind, book: LabBook): ChainQtyEntry[] {
  try {
    const raw = tenantGet(labStorageKey(kind, book))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChainQtyEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function nowTime() {
  return new Date().toTimeString().slice(0, 8)
}

export function saveLabChain(kind: StockKind, book: LabBook, rows: ChainQtyEntry[]) {
  tenantSet(labStorageKey(kind, book), JSON.stringify(rows))
  const spec = getLabSpec(kind)
  if (!spec) return
  const inbound = loadChain(kind, 'issue')
  const used = book === 'used' ? rows : loadLabChain(kind, 'used')
  const process = book === 'process' ? rows : loadLabChain(kind, 'process')
  const consumed = spec.layout === 'silver' ? sumWeights(process) : sumWeights(used)
  const onHand = sumWeights(inbound) - consumed
  store.upsertStockByName(
    `LAB ${kind.replace(/-/g, ' ')}`,
    'Lab',
    Number(onHand.toFixed(3)),
    spec.unit,
  )
}

export function upsertLabBook(
  kind: StockKind,
  book: 'used' | 'process',
  id: string,
  date: string,
  weight: number,
  size?: string,
) {
  if (!getLabSpec(kind)) return
  const next = loadLabChain(kind, book).filter((r) => r.id !== id)
  if (weight > 0) {
    const prev = loadLabChain(kind, book).find((r) => r.id === id)
    next.unshift({
      id,
      date,
      time: prev?.time || nowTime(),
      weight,
      size: size || prev?.size,
    })
  }
  saveLabChain(kind, book, next)
}

function ledgerQtyToLab(kind: StockKind, quantity: number): number {
  if (kind === 'copper' || kind === 'bis-copper') return Number((quantity * 1000).toFixed(3))
  if (kind === 'lead' || kind === 'bis-lead') return Number((quantity * 1000).toFixed(3))
  return quantity
}

/** One-time: old Lab In/Out ledger → used / in-assay. */
export function migrateLabLedger(kind: StockKind) {
  const used = loadLabChain(kind, 'used')
  const process = loadLabChain(kind, 'process')
  const ready = loadLabChain(kind, 'ready')
  const recovered = loadLabChain(kind, 'recovered')
  if (used.length || process.length || ready.length || recovered.length) return
  const ledger = loadLedger(kind, 'lab')
  if (!ledger.length) return
  const spec = getLabSpec(kind)
  const outs: ChainQtyEntry[] = []
  for (const e of ledger) {
    if (e.type !== 'Out') continue
    outs.push({
      id: e.id,
      date: e.date,
      time: '00:00:00',
      weight: ledgerQtyToLab(kind, e.quantity),
    })
  }
  if (!outs.length) return
  if (spec?.layout === 'silver') saveLabChain(kind, 'process', outs)
  else saveLabChain(kind, 'used', outs)
}
