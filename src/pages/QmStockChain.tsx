import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../components/ui'
import {
  getChainSpec,
  loadChain,
  migrateLedgerIntoChain,
  saveChain,
  sumWeights,
  formatCupelSize,
  type ChainQtyEntry,
} from '../data/qmStockChain'
import type { StockKind } from '../data/stockLedger'

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

function nowTime() {
  return new Date().toTimeString().slice(0, 8)
}

function fmtQty(n: number, unit: string) {
  const digits = unit === 'pcs' ? 0 : unit === 'mg' ? 3 : 3
  return `${n.toFixed(digits)} ${unit}`
}

function filterRows(rows: ChainQtyEntry[], start: string, end: string, q: string) {
  const query = q.trim()
  return rows.filter((r) => {
    if (start && r.date < start) return false
    if (end && r.date > end) return false
    if (query && !String(r.weight).includes(query) && !r.weight.toFixed(3).includes(query)) return false
    return true
  })
}

export function QmStockChainPage({
  kind,
  hubPath,
  hubLabel,
}: {
  kind: StockKind
  hubPath: string
  hubLabel: string
}) {
  const spec = getChainSpec(kind)
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    migrateLedgerIntoChain(kind)
    setTick((t) => t + 1)
  }, [kind])

  useEffect(() => {
    if (!spec?.hasSize) return
    setAddSize(spec.defaultSize)
    setIssueSize(spec.defaultSize)
    setUseSize(spec.defaultSize)
  }, [kind, spec?.defaultSize, spec?.hasSize])

  const receipt = useMemo(() => (spec ? loadChain(kind, 'receipt') : []), [kind, spec, tick])
  const issue = useMemo(() => (spec ? loadChain(kind, 'issue') : []), [kind, spec, tick])
  const usage = useMemo(() => (spec ? loadChain(kind, 'usage') : []), [kind, spec, tick])

  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [addQty, setAddQty] = useState('')
  const [addSize, setAddSize] = useState('6')
  const [recStart, setRecStart] = useState('')
  const [recEnd, setRecEnd] = useState('')
  const [recQ, setRecQ] = useState('')

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [issueQty, setIssueQty] = useState('')
  const [issueSize, setIssueSize] = useState('6')
  const [issStart, setIssStart] = useState('')
  const [issEnd, setIssEnd] = useState('')
  const [issQ, setIssQ] = useState('')

  const [useDate, setUseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [useQty, setUseQty] = useState('')
  const [useSize, setUseSize] = useState('6')
  const [useStart, setUseStart] = useState('')
  const [useEnd, setUseEnd] = useState('')
  const [useQ, setUseQ] = useState('')

  const refresh = () => setTick((t) => t + 1)

  const recFiltered = useMemo(
    () => filterRows(receipt, recStart, recEnd, recQ),
    [receipt, recStart, recEnd, recQ],
  )
  const issFiltered = useMemo(
    () => filterRows(issue, issStart, issEnd, issQ),
    [issue, issStart, issEnd, issQ],
  )
  const useFiltered = useMemo(
    () => filterRows(usage, useStart, useEnd, useQ),
    [usage, useStart, useEnd, useQ],
  )

  const available = sumWeights(receipt) - sumWeights(issue)
  const labHolding = sumWeights(issue) - sumWeights(usage)

  if (!spec) {
    return (
      <div className="others-subpage">
        <p>Stock item not found.</p>
        <Link to={hubPath} className="btn btn-navy">
          Back
        </Link>
      </div>
    )
  }

  const parseQty = (raw: string) => {
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  const addReceipt = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseQty(addQty)
    if (!addDate || !w) {
      toast(`Enter date and ${spec.quantityLabel.toLowerCase()}`)
      return
    }
    saveChain(kind, 'receipt', [
      {
        id: `rc-${Date.now()}`,
        date: addDate,
        time: nowTime(),
        weight: w,
        size: spec.hasSize ? addSize : undefined,
      },
      ...receipt,
    ])
    setAddQty('')
    refresh()
    toast('Receipt recorded')
  }

  const addIssue = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseQty(issueQty)
    if (!issueDate || !w) {
      toast(`Enter date and ${spec.quantityLabel.toLowerCase()} to issue`)
      return
    }
    if (w > available + 1e-9) {
      toast('Cannot issue more than available store stock')
      return
    }
    saveChain(kind, 'issue', [
      {
        id: `is-${Date.now()}`,
        date: issueDate,
        time: nowTime(),
        weight: w,
        size: spec.hasSize ? issueSize : undefined,
      },
      ...issue,
    ])
    setIssueQty('')
    refresh()
    toast('Issued to lab')
  }

  const addUsage = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseQty(useQty)
    if (!useDate || !w) {
      toast(`Enter date and ${spec.quantityLabel.toLowerCase()}`)
      return
    }
    if (w > labHolding + 1e-9) {
      toast('Cannot record more than lab holding')
      return
    }
    saveChain(kind, 'usage', [
      {
        id: `us-${Date.now()}`,
        date: useDate,
        time: nowTime(),
        weight: w,
        size: spec.hasSize ? useSize : undefined,
      },
      ...usage,
    ])
    setUseQty('')
    refresh()
    toast(spec.third === 'recovery' ? 'Lab return recorded' : 'Assay usage recorded')
  }

  const editRow = (book: 'receipt' | 'issue' | 'usage', rows: ChainQtyEntry[], id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const next = window.prompt(`Edit ${spec.quantityLabel.toLowerCase()} (${spec.unit})`, String(row.weight))
    if (next === null) return
    const w = Number(next)
    if (!w || w <= 0) {
      toast('Invalid quantity')
      return
    }
    saveChain(
      kind,
      book,
      rows.map((r) => (r.id === id ? { ...r, weight: w } : r)),
    )
    refresh()
    toast('Updated')
  }

  const deleteRow = (book: 'receipt' | 'issue' | 'usage', rows: ChainQtyEntry[], id: string) => {
    if (!window.confirm('Delete this entry?')) return
    saveChain(
      kind,
      book,
      rows.filter((r) => r.id !== id),
    )
    refresh()
    toast('Deleted')
  }

  const sizeSelect = (value: string, onChange: (v: string) => void) =>
    spec.hasSize ? (
      <select value={value} onChange={(e) => onChange(e.target.value)} title={spec.sizeLabel}>
        {spec.sizes.map((s) => (
          <option key={s} value={s}>
            {formatCupelSize(s)}
          </option>
        ))}
      </select>
    ) : null

  const qtyTable = (
    rows: ChainQtyEntry[],
    book: 'receipt' | 'issue' | 'usage',
    allowActions: boolean,
  ) => (
    <div className="table-wrap">
      <table className="data-table qmgold-table">
        <thead>
          <tr>
            <th>Sr</th>
            <th>Date</th>
            <th>Time</th>
            <th>
              {spec.quantityLabel} ({spec.unit})
            </th>
            {spec.hasSize ? <th>{spec.sizeLabel}</th> : null}
            {allowActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={spec.hasSize ? 6 : 5} className="empty-state">
                No entries yet
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.time}</td>
                <td>{fmtQty(r.weight, spec.unit)}</td>
                {spec.hasSize ? <td>{formatCupelSize(r.size)}</td> : null}
                {allowActions ? (
                  <td>
                    <div className="qmgold-row-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => editRow(book, book === 'receipt' ? receipt : book === 'issue' ? issue : usage, r.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-cn-delete btn-sm"
                        onClick={() => deleteRow(book, book === 'receipt' ? receipt : book === 'issue' ? issue : usage, r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))
          )}
          <tr className="qmgold-total-row">
            <td colSpan={3}>
              <strong>Total</strong>
            </td>
            <td colSpan={spec.hasSize || allowActions ? 3 : 1}>
              <strong>{fmtQty(sumWeights(rows), spec.unit)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="qmgold-page">
      <Link to={hubPath} className="back-link">
        <ArrowLeft size={16} /> Back to {hubLabel}
      </Link>

      <header className="qmgold-title">
        <h1>{spec.title}</h1>
        <p>{spec.subtitle}</p>
      </header>

      <section className="qmgold-card">
        <h2>{spec.receiptTitle}</h2>
        <form className="qmgold-form-row" onSubmit={addReceipt}>
          <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step={spec.step}
            placeholder={`${spec.quantityLabel} (${spec.unit})`}
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            required
          />
          {sizeSelect(addSize, setAddSize)}
          <button type="submit" className="btn btn-navy">
            Receive
          </button>
        </form>
        <div className="qmgold-filters">
          <input type="date" value={recStart} onChange={(e) => setRecStart(e.target.value)} title="Start date" />
          <input type="date" value={recEnd} onChange={(e) => setRecEnd(e.target.value)} title="End date" />
          <input
            placeholder={`Search ${spec.quantityLabel.toLowerCase()}`}
            value={recQ}
            onChange={(e) => setRecQ(e.target.value)}
          />
        </div>
        {qtyTable(recFiltered, 'receipt', true)}
      </section>

      <p className="qmgold-balance">
        {spec.availableLabel}: {fmtQty(available, spec.unit)}
      </p>

      <section className="qmgold-card">
        <h2>{spec.issueTitle}</h2>
        <form className="qmgold-form-row" onSubmit={addIssue}>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step={spec.step}
            placeholder={`${spec.quantityLabel} to issue (${spec.unit})`}
            value={issueQty}
            onChange={(e) => setIssueQty(e.target.value)}
            required
          />
          {sizeSelect(issueSize, setIssueSize)}
          <button type="submit" className="btn btn-navy">
            Issue
          </button>
        </form>
        <div className="qmgold-filters">
          <input type="date" value={issStart} onChange={(e) => setIssStart(e.target.value)} title="Start date" />
          <input type="date" value={issEnd} onChange={(e) => setIssEnd(e.target.value)} title="End date" />
          <input
            placeholder={`Search ${spec.quantityLabel.toLowerCase()}`}
            value={issQ}
            onChange={(e) => setIssQ(e.target.value)}
          />
        </div>
        {qtyTable(issFiltered, 'issue', true)}
      </section>

      <p className="qmgold-balance">
        {spec.labHoldingLabel}: {fmtQty(labHolding, spec.unit)}
      </p>

      <section className="qmgold-card">
        <h2>{spec.thirdTitle}</h2>
        <form className="qmgold-form-row" onSubmit={addUsage}>
          <input type="date" value={useDate} onChange={(e) => setUseDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step={spec.step}
            placeholder={`${spec.quantityLabel} (${spec.unit})`}
            value={useQty}
            onChange={(e) => setUseQty(e.target.value)}
            required
          />
          {sizeSelect(useSize, setUseSize)}
          <button type="submit" className="btn btn-navy">
            Add
          </button>
        </form>
        <div className="qmgold-filters">
          <input type="date" value={useStart} onChange={(e) => setUseStart(e.target.value)} title="Start date" />
          <input type="date" value={useEnd} onChange={(e) => setUseEnd(e.target.value)} title="End date" />
          <input
            placeholder={`Search ${spec.quantityLabel.toLowerCase()}`}
            value={useQ}
            onChange={(e) => setUseQ(e.target.value)}
          />
        </div>
        {qtyTable(useFiltered, 'usage', true)}
        <p className="qmgold-balance" style={{ marginBottom: 0 }}>
          {spec.usageTotalLabel}: {fmtQty(sumWeights(useFiltered), spec.unit)}
        </p>
      </section>

      <div className="manual-actions">
        <Link to={hubPath} className="btn btn-navy">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
