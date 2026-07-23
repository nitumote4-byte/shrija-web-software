import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  FlaskConical,
  Package,
  Scale,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useToast } from '../components/ui'
import { tenantGet, tenantSet } from '../data/tenant'
import { store } from '../data/store'
import { QMCGWeightPage } from './CGWeight'

type StockKind =
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

type HubCard = {
  kind: StockKind
  title: string
  description: string
  path: string
  color: string
  symbol?: string
  icon?: 'flask' | 'cupel' | 'scale'
}

type LedgerEntry = {
  id: string
  date: string
  type: 'In' | 'Out'
  quantity: number
  remarks: string
}

const QM_CARDS: HubCard[] = [
  {
    kind: 'gold',
    title: 'GOLD',
    description: 'Gold stock management',
    path: '/qm-stock/gold',
    color: '#D4AF37',
    symbol: 'Au',
  },
  {
    kind: 'silver',
    title: 'SILVER',
    description: 'Silver stock management',
    path: '/qm-stock/silver',
    color: '#94a3b8',
    symbol: 'Ag',
  },
  {
    kind: 'copper',
    title: 'COPPER',
    description: 'Copper stock management',
    path: '/qm-stock/copper',
    color: '#B87333',
    symbol: 'Cu',
  },
  {
    kind: 'lead',
    title: 'LEAD',
    description: 'Lead stock management',
    path: '/qm-stock/lead',
    color: '#4B5563',
    symbol: 'Pb',
  },
  {
    kind: 'acid',
    title: 'ACID',
    description: 'Acid stock management',
    path: '/qm-stock/acid',
    color: '#10B981',
    icon: 'flask',
  },
  {
    kind: 'cuppels',
    title: 'CUPPELS',
    description: 'Cuppels stock management',
    path: '/qm-stock/cuppels',
    color: '#6D28D9',
    icon: 'cupel',
  },
  {
    kind: 'cg-weight',
    title: 'CG WEIGHT',
    description: 'CG weight records',
    path: '/qm-stock/cg-weight',
    color: '#2563eb',
    symbol: 'Au',
  },
]

const BIS_CARDS: HubCard[] = [
  {
    kind: 'bis-gold',
    title: 'GOLD',
    description: 'Gold stock as per BIS',
    path: '/qm-stock/bis/gold',
    color: '#D4AF37',
    symbol: 'Au',
  },
  {
    kind: 'bis-silver',
    title: 'SILVER',
    description: 'Silver stock as per BIS',
    path: '/qm-stock/bis/silver',
    color: '#94a3b8',
    symbol: 'Ag',
  },
  {
    kind: 'bis-copper',
    title: 'COPPER',
    description: 'Copper stock as per BIS',
    path: '/qm-stock/bis/copper',
    color: '#B87333',
    symbol: 'Cu',
  },
  {
    kind: 'bis-lead',
    title: 'LEAD',
    description: 'Lead stock as per BIS',
    path: '/qm-stock/bis/lead',
    color: '#4B5563',
    symbol: 'Pb',
  },
  {
    kind: 'bis-acid',
    title: 'ACID',
    description: 'Acid stock as per BIS',
    path: '/qm-stock/bis/acid',
    color: '#10B981',
    icon: 'flask',
  },
  {
    kind: 'bis-cupels',
    title: 'CUPELS',
    description: 'Cupels stock as per BIS',
    path: '/qm-stock/bis/cupels',
    color: '#6D28D9',
    icon: 'cupel',
  },
]

const LAB_CARDS: HubCard[] = [
  {
    kind: 'gold',
    title: 'GOLD',
    description: 'Gold stock management',
    path: '/lab-stock/gold',
    color: '#D4AF37',
    symbol: 'Au',
  },
  {
    kind: 'silver',
    title: 'SILVER',
    description: 'Silver stock management',
    path: '/lab-stock/silver',
    color: '#94a3b8',
    symbol: 'Ag',
  },
  {
    kind: 'copper',
    title: 'COPPER',
    description: 'Copper stock management',
    path: '/lab-stock/copper',
    color: '#B87333',
    symbol: 'Cu',
  },
  {
    kind: 'lead',
    title: 'LEAD',
    description: 'Lead stock management',
    path: '/lab-stock/lead',
    color: '#4B5563',
    symbol: 'Pb',
  },
  {
    kind: 'acid',
    title: 'ACID',
    description: 'Acid stock management',
    path: '/lab-stock/acid',
    color: '#10B981',
    icon: 'flask',
  },
  {
    kind: 'cuppels',
    title: 'CUPPELS',
    description: 'Cuppels stock management',
    path: '/lab-stock/cuppels',
    color: '#6D28D9',
    icon: 'cupel',
  },
  {
    kind: 'cg-weight',
    title: 'CG WEIGHT',
    description: 'CG weight records',
    path: '/lab-stock/cg-weight',
    color: '#38bdf8',
    symbol: 'CG',
  },
]

const LAB_BIS_CARDS: HubCard[] = [
  {
    kind: 'bis-gold',
    title: 'GOLD',
    description: 'Gold stock as per BIS',
    path: '/lab-stock/bis/gold',
    color: '#D4AF37',
    symbol: 'Au',
  },
  {
    kind: 'bis-silver',
    title: 'SILVER',
    description: 'Silver stock as per BIS',
    path: '/lab-stock/bis/silver',
    color: '#94a3b8',
    symbol: 'Ag',
  },
  {
    kind: 'bis-copper',
    title: 'COPPER',
    description: 'Copper stock as per BIS',
    path: '/lab-stock/bis/copper',
    color: '#B87333',
    symbol: 'Cu',
  },
  {
    kind: 'bis-lead',
    title: 'LEAD',
    description: 'Lead stock as per BIS',
    path: '/lab-stock/bis/lead',
    color: '#4B5563',
    symbol: 'Pb',
  },
  {
    kind: 'bis-acid',
    title: 'ACID',
    description: 'Acid stock as per BIS',
    path: '/lab-stock/bis/acid',
    color: '#10B981',
    icon: 'flask',
  },
  {
    kind: 'bis-cupels',
    title: 'CUPPELS',
    description: 'Cuppels stock as per BIS',
    path: '/lab-stock/bis/cupels',
    color: '#6D28D9',
    icon: 'cupel',
  },
]

const META: Record<
  StockKind,
  { title: string; unit: string; subtitle: string; color: string; symbol?: string; icon?: HubCard['icon'] }
> = {
  gold: { title: 'Gold', unit: 'g', subtitle: 'Gold stock management', color: '#D4AF37', symbol: 'Au' },
  silver: { title: 'Silver', unit: 'g', subtitle: 'Silver stock management', color: '#94a3b8', symbol: 'Ag' },
  copper: { title: 'Copper', unit: 'g', subtitle: 'Copper stock management', color: '#B87333', symbol: 'Cu' },
  lead: { title: 'Lead', unit: 'kg', subtitle: 'Lead stock management', color: '#4B5563', symbol: 'Pb' },
  acid: { title: 'Acid', unit: 'ltr', subtitle: 'Acid stock management', color: '#10B981', icon: 'flask' },
  cuppels: { title: 'Cuppels', unit: 'pcs', subtitle: 'Cuppels stock management', color: '#6D28D9', icon: 'cupel' },
  'cg-weight': {
    title: 'CG Weight',
    unit: 'g',
    subtitle: 'CG weight records',
    color: '#2563eb',
    symbol: 'Au',
  },
  'bis-gold': { title: 'Gold (BIS)', unit: 'g', subtitle: 'Gold stock as per BIS', color: '#D4AF37', symbol: 'Au' },
  'bis-silver': {
    title: 'Silver (BIS)',
    unit: 'g',
    subtitle: 'Silver stock as per BIS',
    color: '#94a3b8',
    symbol: 'Ag',
  },
  'bis-copper': {
    title: 'Copper (BIS)',
    unit: 'g',
    subtitle: 'Copper stock as per BIS',
    color: '#B87333',
    symbol: 'Cu',
  },
  'bis-lead': { title: 'Lead (BIS)', unit: 'kg', subtitle: 'Lead stock as per BIS', color: '#4B5563', symbol: 'Pb' },
  'bis-acid': { title: 'Acid (BIS)', unit: 'ltr', subtitle: 'Acid stock as per BIS', color: '#10B981', icon: 'flask' },
  'bis-cupels': {
    title: 'Cupels (BIS)',
    unit: 'pcs',
    subtitle: 'Cupels stock as per BIS',
    color: '#6D28D9',
    icon: 'cupel',
  },
}

const KIND_BY_SLUG: Record<string, StockKind> = {
  gold: 'gold',
  silver: 'silver',
  copper: 'copper',
  lead: 'lead',
  acid: 'acid',
  cuppels: 'cuppels',
  'cg-weight': 'cg-weight',
  'bis/gold': 'bis-gold',
  'bis/silver': 'bis-silver',
  'bis/copper': 'bis-copper',
  'bis/lead': 'bis-lead',
  'bis/acid': 'bis-acid',
  'bis/cupels': 'bis-cupels',
}

function IconBadge({ card }: { card: Pick<HubCard, 'color' | 'symbol' | 'icon'> }) {
  return (
    <div className="qm-stock-icon" style={{ background: card.color }}>
      {card.symbol ? (
        <span className="qm-stock-symbol">{card.symbol}</span>
      ) : card.icon === 'flask' ? (
        <FlaskConical size={20} />
      ) : card.icon === 'cupel' ? (
        <Package size={20} />
      ) : (
        <Scale size={20} />
      )}
    </div>
  )
}

function StockCard({ card }: { card: HubCard }) {
  return (
    <Link to={card.path} className="others-link-card qm-stock-card">
      <IconBadge card={card} />
      <div className="others-link-text">
        <strong>{card.title}</strong>
        <span>{card.description}</span>
      </div>
      <ArrowRight size={18} className="others-link-arrow" />
    </Link>
  )
}

function loadLedger(kind: StockKind, scope: 'qm' | 'lab' = 'qm'): LedgerEntry[] {
  try {
    const raw = tenantGet(`shrija-${scope}-stock-${kind}`)
    if (!raw) return []
    return JSON.parse(raw) as LedgerEntry[]
  } catch {
    return []
  }
}

function saveLedger(kind: StockKind, entries: LedgerEntry[], scope: 'qm' | 'lab' = 'qm') {
  tenantSet(`shrija-${scope}-stock-${kind}`, JSON.stringify(entries))
  const balance = entries.reduce((s, e) => s + (e.type === 'In' ? e.quantity : -e.quantity), 0)
  const unit = kind === 'cuppels' || kind === 'bis-cupels' ? 'pcs' : 'g'
  store.upsertStockByName(
    `${scope.toUpperCase()} ${kind.replace(/-/g, ' ')}`,
    scope === 'lab' ? 'Lab' : 'QM',
    Number(balance.toFixed(3)),
    unit,
  )
}

/* ——— QM Gold (qmgold.php style) ——— */

type GoldWeightEntry = {
  id: string
  date: string
  time: string
  weight: number
}

type GoldLabEntry = {
  id: string
  date: string
  weight: number
  cornetWeight: number
}

const GOLD_STOCK_KEY = 'shrija-qm-gold-stock'
const GOLD_ISSUE_KEY = 'shrija-qm-gold-issues'
const GOLD_LAB_KEY = 'shrija-qm-gold-lab'
const LAB_GOLD_CG_KEY = 'shrija-lab-gold-cg'

function loadGoldList<T>(key: string): T[] {
  try {
    const raw = tenantGet(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveGoldList<T>(key: string, rows: T[]) {
  tenantSet(key, JSON.stringify(rows))
  // Mirror gold weight lists into centre stock for reports
  if (key.includes('gold-stock') || key.includes('gold-lab') || key.includes('bis-gold-stock')) {
    const total = (rows as { weight?: number }[]).reduce((s, r) => s + (Number(r.weight) || 0), 0)
    const location = key.includes('lab') ? 'Lab' : 'QM'
    const label = key.includes('bis') ? 'BIS gold stock' : key.includes('lab') ? 'Lab gold' : 'QM gold stock'
    store.upsertStockByName(label, location, Number(total.toFixed(3)), 'g')
  }
}

function nowTime() {
  return new Date().toTimeString().slice(0, 8)
}

function fmtGoldDate(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

function gm(n: number, digits = 6) {
  return `${n.toFixed(digits)} gm`
}

function filterByDateWeight(
  rows: GoldWeightEntry[],
  start: string,
  end: string,
  weightQ: string,
) {
  const q = weightQ.trim()
  return rows.filter((r) => {
    if (start && r.date < start) return false
    if (end && r.date > end) return false
    if (q && !String(r.weight).includes(q) && !r.weight.toFixed(6).includes(q)) return false
    return true
  })
}

export function QMGoldStock() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)

  const stock = useMemo(() => loadGoldList<GoldWeightEntry>(GOLD_STOCK_KEY), [tick])
  const issues = useMemo(() => loadGoldList<GoldWeightEntry>(GOLD_ISSUE_KEY), [tick])
  const lab = useMemo(() => loadGoldList<GoldLabEntry>(GOLD_LAB_KEY), [tick])

  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [addWeight, setAddWeight] = useState('')
  const [stockStart, setStockStart] = useState('')
  const [stockEnd, setStockEnd] = useState('')
  const [stockWeightQ, setStockWeightQ] = useState('')

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [issueWeight, setIssueWeight] = useState('')
  const [issueStart, setIssueStart] = useState('')
  const [issueEnd, setIssueEnd] = useState('')
  const [issueWeightQ, setIssueWeightQ] = useState('')

  const [assayStart, setAssayStart] = useState('')
  const [assayEnd, setAssayEnd] = useState('')
  const [assayWeightQ, setAssayWeightQ] = useState('')

  const [labStart, setLabStart] = useState('')
  const [labEnd, setLabEnd] = useState('')
  const [labDate, setLabDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [labWeight, setLabWeight] = useState('')
  const [labCornet, setLabCornet] = useState('')

  const refresh = () => setTick((t) => t + 1)

  const stockFiltered = useMemo(
    () => filterByDateWeight(stock, stockStart, stockEnd, stockWeightQ),
    [stock, stockStart, stockEnd, stockWeightQ],
  )
  const issueFiltered = useMemo(
    () => filterByDateWeight(issues, issueStart, issueEnd, issueWeightQ),
    [issues, issueStart, issueEnd, issueWeightQ],
  )

  const stockTotal = stock.reduce((s, r) => s + r.weight, 0)
  const issueTotal = issues.reduce((s, r) => s + r.weight, 0)
  const remaining = stockTotal - issueTotal
  const cornetReturnTotal = lab.reduce((s, r) => s + r.cornetWeight, 0)
  const assayMasterStock = Math.max(0, issueTotal - cornetReturnTotal)

  const labFiltered = useMemo(
    () =>
      lab.filter((r) => {
        if (labStart && r.date < labStart) return false
        if (labEnd && r.date > labEnd) return false
        return true
      }),
    [lab, labStart, labEnd],
  )

  const assayLabFiltered = useMemo(
    () =>
      lab.filter((r) => {
        if (assayStart && r.date < assayStart) return false
        if (assayEnd && r.date > assayEnd) return false
        if (assayWeightQ.trim()) {
          const q = assayWeightQ.trim()
          if (!String(r.cornetWeight).includes(q) && !r.cornetWeight.toFixed(6).includes(q)) {
            return false
          }
        }
        return true
      }),
    [lab, assayStart, assayEnd, assayWeightQ],
  )

  const assayCornetSum = assayLabFiltered.reduce((s, r) => s + r.cornetWeight, 0)

  const addStock = (e: React.FormEvent) => {
    e.preventDefault()
    const w = Number(addWeight)
    if (!addDate || !w || w <= 0) {
      toast('Enter date and valid weight')
      return
    }
    saveGoldList(GOLD_STOCK_KEY, [
      { id: `gs-${Date.now()}`, date: addDate, time: nowTime(), weight: w },
      ...stock,
    ])
    setAddWeight('')
    refresh()
    toast('Stock added')
  }

  const issueStock = (e: React.FormEvent) => {
    e.preventDefault()
    const w = Number(issueWeight)
    if (!issueDate || !w || w <= 0) {
      toast('Enter date and valid weight')
      return
    }
    if (w > remaining) {
      toast('Insufficient remaining stock')
      return
    }
    saveGoldList(GOLD_ISSUE_KEY, [
      { id: `gi-${Date.now()}`, date: issueDate, time: nowTime(), weight: w },
      ...issues,
    ])
    setIssueWeight('')
    refresh()
    toast('Issued to Assay Master')
  }

  const addLab = (e: React.FormEvent) => {
    e.preventDefault()
    const w = Number(labWeight) || 0
    const c = Number(labCornet) || 0
    if (!labDate || (w <= 0 && c <= 0)) {
      toast('Enter date and weight / cornet weight')
      return
    }
    if (c > assayMasterStock + 0.000001) {
      toast('Cornet return exceeds Assay Master stock')
      return
    }
    saveGoldList(GOLD_LAB_KEY, [
      { id: `gl-${Date.now()}`, date: labDate, weight: w, cornetWeight: c },
      ...lab,
    ])
    setLabWeight('')
    setLabCornet('')
    refresh()
    toast('Lab receipt recorded')
  }

  const editWeightEntry = (
    key: typeof GOLD_STOCK_KEY | typeof GOLD_ISSUE_KEY,
    rows: GoldWeightEntry[],
    id: string,
  ) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const next = window.prompt('Edit weight (gm)', String(row.weight))
    if (next === null) return
    const w = Number(next)
    if (!w || w <= 0) {
      toast('Invalid weight')
      return
    }
    saveGoldList(
      key,
      rows.map((r) => (r.id === id ? { ...r, weight: w } : r)),
    )
    refresh()
    toast('Updated')
  }

  const deleteWeightEntry = (
    key: typeof GOLD_STOCK_KEY | typeof GOLD_ISSUE_KEY,
    rows: GoldWeightEntry[],
    id: string,
  ) => {
    if (!window.confirm('Delete this entry?')) return
    saveGoldList(
      key,
      rows.filter((r) => r.id !== id),
    )
    refresh()
    toast('Deleted')
  }

  const deleteLab = (id: string) => {
    if (!window.confirm('Delete this lab entry?')) return
    saveGoldList(
      GOLD_LAB_KEY,
      lab.filter((r) => r.id !== id),
    )
    refresh()
    toast('Deleted')
  }

  return (
    <div className="qmgold-page">
      <Link to="/qm-stock" className="back-link">
        <ArrowLeft size={16} /> Back to QM Stock
      </Link>

      <header className="qmgold-title">
        <h1>Report</h1>
        <p>QM Gold stock · Add, issue to Assay Master, and track lab returns</p>
      </header>

      {/* Add New Stock */}
      <section className="qmgold-card">
        <h2>Add New Stock</h2>
        <form className="qmgold-form-row" onSubmit={addStock}>
          <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Enter weight"
            value={addWeight}
            onChange={(e) => setAddWeight(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-navy">
            Add Stock
          </button>
        </form>

        <div className="qmgold-filters">
          <input type="date" value={stockStart} onChange={(e) => setStockStart(e.target.value)} title="Start Date" />
          <input type="date" value={stockEnd} onChange={(e) => setStockEnd(e.target.value)} title="End Date" />
          <input
            placeholder="Search weight"
            value={stockWeightQ}
            onChange={(e) => setStockWeightQ(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="data-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>Time</th>
                <th>Weight</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stockFiltered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No stock entries
                  </td>
                </tr>
              ) : (
                stockFiltered.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{fmtGoldDate(r.date)}</td>
                    <td>{r.time}</td>
                    <td>{gm(r.weight)}</td>
                    <td>
                      <div className="qmgold-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => editWeightEntry(GOLD_STOCK_KEY, stock, r.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-cn-delete btn-sm"
                          onClick={() => deleteWeightEntry(GOLD_STOCK_KEY, stock, r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              <tr className="qmgold-total-row">
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td colSpan={2}>
                  <strong>{gm(stockFiltered.reduce((s, r) => s + r.weight, 0), 3)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="qmgold-balance">Remaining: {gm(remaining, 3)}</p>

      {/* Issue to Assay Master */}
      <section className="qmgold-card">
        <h2>Issue to Assay Master</h2>
        <form className="qmgold-form-row" onSubmit={issueStock}>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Enter weight to issue"
            value={issueWeight}
            onChange={(e) => setIssueWeight(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-navy">
            Issue
          </button>
        </form>

        <div className="qmgold-filters">
          <input type="date" value={issueStart} onChange={(e) => setIssueStart(e.target.value)} title="Start Date" />
          <input type="date" value={issueEnd} onChange={(e) => setIssueEnd(e.target.value)} title="End Date" />
          <input
            placeholder="Search weight"
            value={issueWeightQ}
            onChange={(e) => setIssueWeightQ(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="data-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>Time</th>
                <th>Weight</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issueFiltered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No issues yet
                  </td>
                </tr>
              ) : (
                issueFiltered.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{fmtGoldDate(r.date)}</td>
                    <td>{r.time}</td>
                    <td>{gm(r.weight)}</td>
                    <td>
                      <div className="qmgold-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => editWeightEntry(GOLD_ISSUE_KEY, issues, r.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-cn-delete btn-sm"
                          onClick={() => deleteWeightEntry(GOLD_ISSUE_KEY, issues, r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              <tr className="qmgold-total-row">
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td colSpan={2}>
                  <strong>{gm(issueFiltered.reduce((s, r) => s + r.weight, 0), 3)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="qmgold-balance">Assay Master Stock: {gm(assayMasterStock)}</p>

      {/* Gold After Assaying */}
      <section className="qmgold-card">
        <h2>Gold After Assaying (CG Cornet)</h2>
        <div className="qmgold-filters">
          <input type="date" value={assayStart} onChange={(e) => setAssayStart(e.target.value)} title="Start Date" />
          <input type="date" value={assayEnd} onChange={(e) => setAssayEnd(e.target.value)} title="End Date" />
          <input
            placeholder="Search by Weight"
            value={assayWeightQ}
            onChange={(e) => setAssayWeightQ(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table className="data-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>Weight</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2}>Gold return From Assay Master (Total Cornet Weight)</td>
                <td>{gm(assayCornetSum)}</td>
                <td>{gm(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Gold Received From Lab */}
      <section className="qmgold-card">
        <h2>Gold Received From Lab</h2>
        <form className="qmgold-form-row" onSubmit={addLab}>
          <input type="date" value={labDate} onChange={(e) => setLabDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Weight"
            value={labWeight}
            onChange={(e) => setLabWeight(e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Cornet weight"
            value={labCornet}
            onChange={(e) => setLabCornet(e.target.value)}
          />
          <button type="submit" className="btn btn-navy">
            Add
          </button>
        </form>
        <div className="qmgold-filters">
          <input type="date" value={labStart} onChange={(e) => setLabStart(e.target.value)} title="Start Date" />
          <input type="date" value={labEnd} onChange={(e) => setLabEnd(e.target.value)} title="End Date" />
        </div>
        <div className="table-wrap">
          <table className="data-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>Weight</th>
                <th>Cornet Weight</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {labFiltered.length === 0 ? (
                <tr>
                  <td colSpan={2}>Gold return From Assay Master (Total Cornet Weight)</td>
                  <td>{gm(0)}</td>
                  <td>{gm(0)}</td>
                  <td />
                </tr>
              ) : (
                labFiltered.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{fmtGoldDate(r.date)}</td>
                    <td>{gm(r.weight)}</td>
                    <td>{gm(r.cornetWeight)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-cn-delete btn-sm"
                        onClick={() => deleteLab(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="manual-actions">
        <Link to="/qm-stock" className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

/* ——— QM Gold As Per BIS (qmgoldbis.php) ——— */

type BisCornetEntry = {
  id: string
  date: string
  wotgca1: number
  wotgca2: number
  return1: number
  return2: number
}

const BIS_GOLD_STOCK_KEY = 'shrija-qm-bis-gold-stock'
const BIS_GOLD_ISSUE_KEY = 'shrija-qm-bis-gold-issues'
const BIS_GOLD_CORNET_KEY = 'shrija-qm-bis-gold-cornet'

function seedBisCornet(): BisCornetEntry[] {
  return [
    { id: 'bc1', date: '2026-07-21', wotgca1: 448.795, wotgca2: 448.655, return1: 0.85, return2: 0.86 },
    { id: 'bc2', date: '2026-07-20', wotgca1: 299.374, wotgca2: 299.594, return1: 0.78, return2: 0.79 },
    { id: 'bc3', date: '2026-07-18', wotgca1: 299.898, wotgca2: 299.887, return1: 0.82, return2: 0.81 },
    { id: 'bc4', date: '2026-07-17', wotgca1: 299.436, wotgca2: 299.487, return1: 0.76, return2: 0.77 },
    { id: 'bc5', date: '2026-07-16', wotgca1: 449.392, wotgca2: 449.46, return1: 0.91, return2: 0.9 },
    { id: 'bc6', date: '2026-07-14', wotgca1: 299.512, wotgca2: 299.498, return1: 0.72, return2: 0.73 },
    { id: 'bc7', date: '2026-07-13', wotgca1: 149.315, wotgca2: 149.282, return1: 0.65, return2: 0.64 },
    { id: 'bc8', date: '2026-07-11', wotgca1: 299.201, wotgca2: 299.255, return1: 0.647909, return2: 0.639167 },
  ]
}

function loadBisCornet(): BisCornetEntry[] {
  try {
    const raw = tenantGet(BIS_GOLD_CORNET_KEY)
    if (!raw) {
      const seed = seedBisCornet()
      saveGoldList(BIS_GOLD_CORNET_KEY, seed)
      return seed
    }
    const parsed = JSON.parse(raw) as BisCornetEntry[]
    return Array.isArray(parsed) ? parsed : seedBisCornet()
  } catch {
    return seedBisCornet()
  }
}

export function QMBISGoldStock() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)

  const stock = useMemo(() => loadGoldList<GoldWeightEntry>(BIS_GOLD_STOCK_KEY), [tick])
  const issues = useMemo(() => loadGoldList<GoldWeightEntry>(BIS_GOLD_ISSUE_KEY), [tick])
  const cornets = useMemo(() => loadBisCornet(), [tick])

  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [addWeight, setAddWeight] = useState('')
  const [stockStart, setStockStart] = useState('')
  const [stockEnd, setStockEnd] = useState('')
  const [stockWeightQ, setStockWeightQ] = useState('')

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [issueWeight, setIssueWeight] = useState('')
  const [issueStart, setIssueStart] = useState('')
  const [issueEnd, setIssueEnd] = useState('')
  const [issueWeightQ, setIssueWeightQ] = useState('')

  const [cornetStart, setCornetStart] = useState('')
  const [cornetEnd, setCornetEnd] = useState('')
  const [cornetWeightQ, setCornetWeightQ] = useState('')
  const [cornetDate, setCornetDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [wotgca1, setWotgca1] = useState('')
  const [wotgca2, setWotgca2] = useState('')
  const [return1, setReturn1] = useState('')
  const [return2, setReturn2] = useState('')

  const refresh = () => setTick((t) => t + 1)

  const stockFiltered = useMemo(
    () => filterByDateWeight(stock, stockStart, stockEnd, stockWeightQ),
    [stock, stockStart, stockEnd, stockWeightQ],
  )
  const issueFiltered = useMemo(
    () => filterByDateWeight(issues, issueStart, issueEnd, issueWeightQ),
    [issues, issueStart, issueEnd, issueWeightQ],
  )

  const cornetFiltered = useMemo(() => {
    const q = cornetWeightQ.trim()
    return cornets
      .filter((r) => {
        if (cornetStart && r.date < cornetStart) return false
        if (cornetEnd && r.date > cornetEnd) return false
        if (q) {
          const hit =
            r.wotgca1.toFixed(6).includes(q) ||
            r.wotgca2.toFixed(6).includes(q) ||
            String(r.wotgca1).includes(q) ||
            String(r.wotgca2).includes(q)
          if (!hit) return false
        }
        return true
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [cornets, cornetStart, cornetEnd, cornetWeightQ])

  const stockTotal = stock.reduce((s, r) => s + r.weight, 0)
  const issueTotal = issues.reduce((s, r) => s + r.weight, 0)
  const remaining = stockTotal - issueTotal
  const returnTotal2 = cornets.reduce((s, r) => s + (r.return2 || 0), 0)
  const assayMasterStock = Math.max(0, issueTotal - returnTotal2)

  const filteredReturn1 = cornetFiltered.reduce((s, r) => s + (r.return1 || 0), 0)
  const filteredReturn2 = cornetFiltered.reduce((s, r) => s + (r.return2 || 0), 0)

  const addStock = (e: React.FormEvent) => {
    e.preventDefault()
    const w = Number(addWeight)
    if (!addDate || !w || w <= 0) {
      toast('Enter date and valid weight')
      return
    }
    saveGoldList(BIS_GOLD_STOCK_KEY, [
      { id: `bgs-${Date.now()}`, date: addDate, time: nowTime(), weight: w },
      ...stock,
    ])
    setAddWeight('')
    refresh()
    toast('BIS gold stock added')
  }

  const issueStock = (e: React.FormEvent) => {
    e.preventDefault()
    const w = Number(issueWeight)
    if (!issueDate || !w || w <= 0) {
      toast('Enter date and valid weight')
      return
    }
    if (w > remaining) {
      toast('Insufficient remaining stock')
      return
    }
    saveGoldList(BIS_GOLD_ISSUE_KEY, [
      { id: `bgi-${Date.now()}`, date: issueDate, time: nowTime(), weight: w },
      ...issues,
    ])
    setIssueWeight('')
    refresh()
    toast('Issued to Assay Master')
  }

  const addCornet = (e: React.FormEvent) => {
    e.preventDefault()
    const w1 = Number(wotgca1)
    const w2 = Number(wotgca2)
    if (!cornetDate || (!w1 && !w2)) {
      toast('Enter date and wotgca values')
      return
    }
    const next: BisCornetEntry[] = [
      {
        id: `bc-${Date.now()}`,
        date: cornetDate,
        wotgca1: w1 || 0,
        wotgca2: w2 || 0,
        return1: Number(return1) || 0,
        return2: Number(return2) || 0,
      },
      ...cornets,
    ]
    saveGoldList(BIS_GOLD_CORNET_KEY, next)
    setWotgca1('')
    setWotgca2('')
    setReturn1('')
    setReturn2('')
    refresh()
    toast('Cornet entry added')
  }

  const editWeightEntry = (
    key: typeof BIS_GOLD_STOCK_KEY | typeof BIS_GOLD_ISSUE_KEY,
    rows: GoldWeightEntry[],
    id: string,
  ) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const next = window.prompt('Edit weight (gm)', String(row.weight))
    if (next === null) return
    const w = Number(next)
    if (!w || w <= 0) {
      toast('Invalid weight')
      return
    }
    saveGoldList(
      key,
      rows.map((r) => (r.id === id ? { ...r, weight: w } : r)),
    )
    refresh()
    toast('Updated')
  }

  const deleteWeightEntry = (
    key: typeof BIS_GOLD_STOCK_KEY | typeof BIS_GOLD_ISSUE_KEY,
    rows: GoldWeightEntry[],
    id: string,
  ) => {
    if (!window.confirm('Delete this entry?')) return
    saveGoldList(
      key,
      rows.filter((r) => r.id !== id),
    )
    refresh()
    toast('Deleted')
  }

  const deleteCornet = (id: string) => {
    if (!window.confirm('Delete this cornet entry?')) return
    saveGoldList(
      BIS_GOLD_CORNET_KEY,
      cornets.filter((r) => r.id !== id),
    )
    refresh()
    toast('Deleted')
  }

  return (
    <div className="qmgold-page">
      <Link to="/qm-stock" className="back-link">
        <ArrowLeft size={16} /> Back to QM Stock
      </Link>

      <header className="qmgold-title">
        <h1>Report</h1>
        <p>QM Stock As Per BIS · Gold</p>
      </header>

      <div className="qmbis-summary">
        <span>
          Total: <strong>{stockTotal.toFixed(6)}</strong>
        </span>
        <span>
          Remaining: <strong>{remaining.toFixed(6)}</strong>
        </span>
      </div>

      <section className="qmgold-card">
        <h2>Add New Stock</h2>
        <form className="qmgold-form-row" onSubmit={addStock}>
          <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Enter weight"
            value={addWeight}
            onChange={(e) => setAddWeight(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-navy">
            Add Stock
          </button>
        </form>

        <div className="qmgold-filters">
          <input type="date" value={stockStart} onChange={(e) => setStockStart(e.target.value)} title="Start Date" />
          <input type="date" value={stockEnd} onChange={(e) => setStockEnd(e.target.value)} title="End Date" />
          <input
            placeholder="Search weight"
            value={stockWeightQ}
            onChange={(e) => setStockWeightQ(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="data-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>Time</th>
                <th>Weight</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stockFiltered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No stock entries
                  </td>
                </tr>
              ) : (
                stockFiltered.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{fmtGoldDate(r.date)}</td>
                    <td>{r.time}</td>
                    <td>{r.weight.toFixed(6)}</td>
                    <td>
                      <div className="qmgold-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => editWeightEntry(BIS_GOLD_STOCK_KEY, stock, r.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-cn-delete btn-sm"
                          onClick={() => deleteWeightEntry(BIS_GOLD_STOCK_KEY, stock, r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              <tr className="qmgold-total-row">
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td colSpan={2}>
                  <strong>{stockFiltered.reduce((s, r) => s + r.weight, 0).toFixed(6)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="qmgold-balance">Remaining: {remaining.toFixed(6)}</p>

      <section className="qmgold-card">
        <h2>Issue to Assay Master</h2>
        <form className="qmgold-form-row" onSubmit={issueStock}>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Enter weight to issue"
            value={issueWeight}
            onChange={(e) => setIssueWeight(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-navy">
            Issue
          </button>
        </form>

        <div className="qmgold-filters">
          <input type="date" value={issueStart} onChange={(e) => setIssueStart(e.target.value)} title="Start Date" />
          <input type="date" value={issueEnd} onChange={(e) => setIssueEnd(e.target.value)} title="End Date" />
          <input
            placeholder="Search weight"
            value={issueWeightQ}
            onChange={(e) => setIssueWeightQ(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="data-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>Time</th>
                <th>Weight</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issueFiltered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No issues yet
                  </td>
                </tr>
              ) : (
                issueFiltered.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{fmtGoldDate(r.date)}</td>
                    <td>{r.time}</td>
                    <td>{r.weight.toFixed(6)}</td>
                    <td>
                      <div className="qmgold-row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => editWeightEntry(BIS_GOLD_ISSUE_KEY, issues, r.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-cn-delete btn-sm"
                          onClick={() => deleteWeightEntry(BIS_GOLD_ISSUE_KEY, issues, r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              <tr className="qmgold-total-row">
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td colSpan={2}>
                  <strong>{issueFiltered.reduce((s, r) => s + r.weight, 0).toFixed(6)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="qmgold-balance">Assay Master Stock: {assayMasterStock.toFixed(6)}</p>

      <section className="qmgold-card">
        <h2>Gold After Assaying (CG Cornet)</h2>
        <form className="qmgold-form-row" onSubmit={addCornet}>
          <input type="date" value={cornetDate} onChange={(e) => setCornetDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="wotgca1"
            value={wotgca1}
            onChange={(e) => setWotgca1(e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="wotgca2"
            value={wotgca2}
            onChange={(e) => setWotgca2(e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Return 1"
            value={return1}
            onChange={(e) => setReturn1(e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Return 2"
            value={return2}
            onChange={(e) => setReturn2(e.target.value)}
          />
          <button type="submit" className="btn btn-navy">
            Add
          </button>
        </form>

        <div className="qmgold-filters">
          <input type="date" value={cornetStart} onChange={(e) => setCornetStart(e.target.value)} title="Start Date" />
          <input type="date" value={cornetEnd} onChange={(e) => setCornetEnd(e.target.value)} title="End Date" />
          <input
            placeholder="Search weight"
            value={cornetWeightQ}
            onChange={(e) => setCornetWeightQ(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="data-table navy-head-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>wotgca1</th>
                <th>wotgca2</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cornetFiltered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No cornet records
                  </td>
                </tr>
              ) : (
                cornetFiltered.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{fmtGoldDate(r.date)}</td>
                    <td>{gm(r.wotgca1)}</td>
                    <td>{gm(r.wotgca2)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-cn-delete btn-sm"
                        onClick={() => deleteCornet(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
              <tr className="qmgold-total-row">
                <td colSpan={2}>Gold return From Assay Master (Total Cornet Weight)</td>
                <td>{filteredReturn1.toFixed(6)}</td>
                <td colSpan={2}>{filteredReturn2.toFixed(6)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="manual-actions">
        <Link to="/qm-stock" className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

export function QMStock() {
  return (
    <div className="qm-stock-hub">
      <section className="qm-stock-section">
        <div className="qm-stock-section-head">
          <div className="qm-stock-section-icon">
            <Boxes size={22} />
          </div>
          <div>
            <h1>QM Stock</h1>
            <p>Manage and view all quality manager stock items</p>
          </div>
        </div>
        <div className="others-card-grid">
          {QM_CARDS.map((card) => (
            <StockCard key={card.path} card={card} />
          ))}
        </div>
      </section>

      <hr className="qm-stock-divider" />

      <section className="qm-stock-section">
        <div className="qm-stock-section-head">
          <div className="qm-stock-section-icon bis">
            <BadgeCheck size={22} />
          </div>
          <div>
            <h1>QM Stock As Per BIS</h1>
            <p>Stock records according to BIS standards</p>
          </div>
        </div>
        <div className="others-card-grid">
          {BIS_CARDS.map((card) => (
            <StockCard key={card.path} card={card} />
          ))}
        </div>
      </section>

      <div className="manual-actions">
        <Link to="/" className="btn btn-navy">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
    </div>
  )
}

export function LabGoldStock() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)

  const givenByQm = useMemo(() => loadGoldList<GoldWeightEntry>(GOLD_ISSUE_KEY), [tick])
  const cgUsed = useMemo(() => loadGoldList<GoldLabEntry>(LAB_GOLD_CG_KEY), [tick])

  const [qmStart, setQmStart] = useState('')
  const [qmEnd, setQmEnd] = useState('')
  const [qmWeightQ, setQmWeightQ] = useState('')

  const [cgStart, setCgStart] = useState('')
  const [cgEnd, setCgEnd] = useState('')
  const [cgWeightQ, setCgWeightQ] = useState('')

  const [useDate, setUseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [useWeight, setUseWeight] = useState('')
  const [useCornet, setUseCornet] = useState('')

  const refresh = () => setTick((t) => t + 1)

  const qmFiltered = useMemo(
    () => filterByDateWeight(givenByQm, qmStart, qmEnd, qmWeightQ),
    [givenByQm, qmStart, qmEnd, qmWeightQ],
  )

  const cgFiltered = useMemo(() => {
    const q = cgWeightQ.trim()
    return cgUsed.filter((r) => {
      if (cgStart && r.date < cgStart) return false
      if (cgEnd && r.date > cgEnd) return false
      if (q) {
        const hit =
          r.weight.toFixed(6).includes(q) ||
          r.cornetWeight.toFixed(6).includes(q) ||
          String(r.weight).includes(q)
        if (!hit) return false
      }
      return true
    })
  }, [cgUsed, cgStart, cgEnd, cgWeightQ])

  const totalStock = givenByQm.reduce((s, r) => s + r.weight, 0)
  const totalCg = cgUsed.reduce((s, r) => s + r.weight, 0)
  const totalCornet = cgUsed.reduce((s, r) => s + r.cornetWeight, 0)
  const assayStock = Math.max(0, totalStock - totalCg)
  const cgBall = 0
  const difference = -totalCg

  const filteredQmTotal = qmFiltered.reduce((s, r) => s + r.weight, 0)
  const filteredCgTotal = cgFiltered.reduce((s, r) => s + r.weight, 0)
  const filteredCornetTotal = cgFiltered.reduce((s, r) => s + r.cornetWeight, 0)

  const addCgUse = (e: React.FormEvent) => {
    e.preventDefault()
    const w = Number(useWeight) || 0
    const c = Number(useCornet) || 0
    if (!useDate || (w <= 0 && c <= 0)) {
      toast('Enter date and CG / cornet weight')
      return
    }
    if (w > assayStock + 0.000001) {
      toast('CG weight exceeds assay stock')
      return
    }
    saveGoldList(LAB_GOLD_CG_KEY, [
      { id: `lcg-${Date.now()}`, date: useDate, weight: w, cornetWeight: c },
      ...cgUsed,
    ])
    // Keep QM gold page in sync for returned cornet total
    saveGoldList(GOLD_LAB_KEY, [
      { id: `gl-${Date.now()}`, date: useDate, weight: w, cornetWeight: w || c },
      ...loadGoldList<GoldLabEntry>(GOLD_LAB_KEY),
    ])
    setUseWeight('')
    setUseCornet('')
    refresh()
    toast('CG usage recorded')
  }

  const deleteCg = (id: string) => {
    if (!window.confirm('Delete this CG usage entry?')) return
    saveGoldList(
      LAB_GOLD_CG_KEY,
      cgUsed.filter((r) => r.id !== id),
    )
    refresh()
    toast('Deleted')
  }

  const sendToQm = () => {
    if (assayStock <= 0) {
      toast('No assay stock to send')
      return
    }
    const amount = window.prompt('Weight to send to QM (gm)', assayStock.toFixed(6))
    if (amount === null) return
    const w = Number(amount)
    if (!w || w <= 0) {
      toast('Invalid weight')
      return
    }
    if (w > assayStock + 0.000001) {
      toast('Cannot send more than assay stock')
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    saveGoldList(GOLD_LAB_KEY, [
      {
        id: `gl-send-${Date.now()}`,
        date: today,
        weight: w,
        cornetWeight: w,
      },
      ...loadGoldList<GoldLabEntry>(GOLD_LAB_KEY),
    ])
    saveGoldList(LAB_GOLD_CG_KEY, [
      { id: `lcg-send-${Date.now()}`, date: today, weight: w, cornetWeight: 0 },
      ...cgUsed,
    ])
    refresh()
    toast(`Sent ${w.toFixed(6)} gm to QM`)
  }

  return (
    <div className="qmgold-page labgold-page">
      <Link to="/lab-stock" className="back-link">
        <ArrowLeft size={16} /> Back to Lab Stock
      </Link>

      <header className="qmgold-title">
        <h1>Report</h1>
        <p>Lab Stock · Gold</p>
      </header>

      <div className="labgold-stats">
        <div className="labgold-stat assay">
          <span>ASSAY STOCK</span>
          <strong>{assayStock.toFixed(6)}</strong>
        </div>
        <div className="labgold-stat ball">
          <span>CG BALL</span>
          <strong>{cgBall.toFixed(6)}</strong>
        </div>
        <div className="labgold-stat used">
          <span>USED CG</span>
          <strong>{totalCg.toFixed(6)}</strong>
        </div>
        <div className="labgold-stat cornet">
          <span>CG CORNET</span>
          <strong>{totalCornet.toFixed(6)}</strong>
        </div>
      </div>

      <section className="qmgold-card">
        <h2>Gold Given By QM</h2>
        <div className="qmgold-filters">
          <input type="date" value={qmStart} onChange={(e) => setQmStart(e.target.value)} title="Start Date" />
          <input type="date" value={qmEnd} onChange={(e) => setQmEnd(e.target.value)} title="End Date" />
          <input
            placeholder="Search by Weight"
            value={qmWeightQ}
            onChange={(e) => setQmWeightQ(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table className="data-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>Time</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {qmFiltered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No gold received from QM yet (issue from QM Stock → Gold)
                  </td>
                </tr>
              ) : (
                qmFiltered.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{fmtGoldDate(r.date)}</td>
                    <td>{r.time}</td>
                    <td>{gm(r.weight)}</td>
                  </tr>
                ))
              )}
              <tr className="qmgold-total-row">
                <td colSpan={3}>
                  <strong>Total Stock</strong>
                </td>
                <td>
                  <strong>{gm(filteredQmTotal)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="labgold-assay-line">Assay Master Stock: {gm(assayStock)}</p>
      </section>

      <section className="qmgold-card">
        <h2>Gold Used For Assaying (CG Weight)</h2>
        <form className="qmgold-form-row" onSubmit={addCgUse}>
          <input type="date" value={useDate} onChange={(e) => setUseDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="CG Weight"
            value={useWeight}
            onChange={(e) => setUseWeight(e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Cornet weight"
            value={useCornet}
            onChange={(e) => setUseCornet(e.target.value)}
          />
          <button type="submit" className="btn btn-navy">
            Add
          </button>
        </form>
        <div className="qmgold-filters">
          <input type="date" value={cgStart} onChange={(e) => setCgStart(e.target.value)} title="Start Date" />
          <input type="date" value={cgEnd} onChange={(e) => setCgEnd(e.target.value)} title="End Date" />
          <input
            placeholder="Search by Weight"
            value={cgWeightQ}
            onChange={(e) => setCgWeightQ(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table className="data-table qmgold-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Date</th>
                <th>Weight</th>
                <th>Cornet weight</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cgFiltered.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{fmtGoldDate(r.date)}</td>
                  <td>{gm(r.weight)}</td>
                  <td>{gm(r.cornetWeight)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-cn-delete btn-sm"
                      onClick={() => deleteCg(r.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="qmgold-total-row">
                <td colSpan={2}>
                  <strong>Total CG Weight</strong>
                </td>
                <td colSpan={3}>
                  <strong>{gm(filteredCgTotal)}</strong>
                </td>
              </tr>
              <tr className="qmgold-total-row">
                <td colSpan={2}>
                  <strong>Cornet weight</strong>
                </td>
                <td colSpan={3}>
                  <strong>{gm(filteredCornetTotal)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="labgold-diff-line">Difference: {difference.toFixed(6)} gm</p>
      </section>

      <div className="labgold-actions">
        <button type="button" className="btn btn-navy" onClick={sendToQm}>
          Send To Qm
        </button>
        <Link to="/lab-stock" className="btn btn-secondary">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

export function QMStockItem() {
  return <StockItemPage scope="qm" hubPath="/qm-stock" hubLabel="QM Stock" />
}

export function LabStockItem() {
  return <StockItemPage scope="lab" hubPath="/lab-stock" hubLabel="Lab Stock" />
}

function StockItemPage({
  scope,
  hubPath,
  hubLabel,
}: {
  scope: 'qm' | 'lab'
  hubPath: string
  hubLabel: string
}) {
  const { item, bisItem } = useParams<{ item?: string; bisItem?: string }>()
  const slug = bisItem ? `bis/${bisItem}` : item || ''
  const kind = KIND_BY_SLUG[slug]

  // Gold Shark cg_weight.php — dedicated Unused / Used CG weight flow
  if (kind === 'cg-weight') {
    return <QMCGWeightPage hubPath={hubPath} />
  }

  return (
    <StockItemLedgerPage
      kind={kind}
      scope={scope}
      hubPath={hubPath}
      hubLabel={hubLabel}
    />
  )
}

function StockItemLedgerPage({
  kind,
  scope,
  hubPath,
  hubLabel,
}: {
  kind: StockKind | undefined
  scope: 'qm' | 'lab'
  hubPath: string
  hubLabel: string
}) {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const [qty, setQty] = useState('')
  const [type, setType] = useState<'In' | 'Out'>('In')
  const [remarks, setRemarks] = useState('')

  const meta = kind ? META[kind] : null
  const badgeMeta =
    kind === 'cg-weight' && scope === 'lab' && meta
      ? { ...meta, symbol: 'CG', color: '#38bdf8' }
      : meta
  const entries = useMemo(() => (kind ? loadLedger(kind, scope) : []), [kind, scope, tick])
  const balance = useMemo(
    () => entries.reduce((sum, e) => sum + (e.type === 'In' ? e.quantity : -e.quantity), 0),
    [entries],
  )

  if (!kind || !meta || !badgeMeta) {
    return (
      <div className="others-subpage">
        <p>Stock item not found.</p>
        <Link to={hubPath} className="btn btn-navy">
          Back
        </Link>
      </div>
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const quantity = Number(qty)
    if (!quantity || quantity <= 0) {
      toast('Enter a valid quantity')
      return
    }
    if (type === 'Out' && quantity > balance) {
      toast('Insufficient stock balance')
      return
    }
    const next: LedgerEntry[] = [
      {
        id: `le-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        type,
        quantity,
        remarks: remarks.trim() || (type === 'In' ? 'Stock in' : 'Stock out'),
      },
      ...entries,
    ]
    saveLedger(kind, next, scope)
    setQty('')
    setRemarks('')
    setTick((t) => t + 1)
    toast(`${type === 'In' ? 'Added' : 'Issued'} ${quantity} ${meta.unit}`)
  }

  return (
    <div className="qm-stock-item-page">
      <Link to={hubPath} className="back-link">
        <ArrowLeft size={16} /> Back to {hubLabel}
      </Link>

      <div className="qm-stock-item-head">
        <IconBadge card={badgeMeta} />
        <div>
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span>Current Balance</span>
          <strong>
            {balance.toFixed(3)} {meta.unit}
          </strong>
        </div>
        <div className="stat-card">
          <span>Entries</span>
          <strong>{entries.length}</strong>
        </div>
      </div>

      <div className="panel">
        <h2>Stock Movement</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'In' | 'Out')}>
                <option value="In">Stock In</option>
                <option value="Out">Stock Out</option>
              </select>
            </div>
            <div className="field">
              <label>Quantity ({meta.unit})</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Remarks</label>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-navy">
              Save Entry
            </button>
          </div>
        </form>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="data-table navy-head-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No stock movements yet
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>
                      <span className={`badge ${e.type === 'In' ? 'badge-done' : 'badge-danger'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td>
                      {e.quantity} {meta.unit}
                    </td>
                    <td>{e.remarks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="manual-actions">
        <Link to={hubPath} className="btn btn-navy">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}

export function LabStock() {
  return (
    <div className="qm-stock-hub">
      <section className="qm-stock-section">
        <div className="qm-stock-section-head">
          <div className="qm-stock-section-icon">
            <FlaskConical size={22} />
          </div>
          <div>
            <h1>Lab Stock</h1>
            <p>Manage and view all laboratory stock items</p>
          </div>
        </div>
        <div className="others-card-grid">
          {LAB_CARDS.map((card) => (
            <StockCard key={card.path} card={card} />
          ))}
        </div>
      </section>

      <hr className="qm-stock-divider" />

      <section className="qm-stock-section">
        <div className="qm-stock-section-head">
          <div className="qm-stock-section-icon bis">
            <BadgeCheck size={22} />
          </div>
          <div>
            <h1>Lab Stock As Per BIS</h1>
            <p>Stock records according to BIS standards</p>
          </div>
        </div>
        <div className="others-card-grid">
          {LAB_BIS_CARDS.map((card) => (
            <StockCard key={card.path} card={card} />
          ))}
        </div>
      </section>

      <div className="manual-actions">
        <Link to="/" className="btn btn-navy">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
    </div>
  )
}
