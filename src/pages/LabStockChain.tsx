import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../components/ui'
import { loadChain, saveChain, sumWeights, formatCupelSize, type ChainQtyEntry } from '../data/qmStockChain'
import {
  getLabSpec,
  loadLabChain,
  migrateLabLedger,
  saveLabChain,
  type LabBook,
} from '../data/labStockChain'
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
  const digits = unit === 'pcs' ? 0 : 3
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

export function LabStockChainPage({
  kind,
  hubPath,
  hubLabel,
}: {
  kind: StockKind
  hubPath: string
  hubLabel: string
}) {
  const spec = getLabSpec(kind)
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    migrateLabLedger(kind)
    setTick((t) => t + 1)
  }, [kind])

  useEffect(() => {
    if (!spec?.hasSize) return
    setReadySize(spec.defaultSize)
    setUseSize(spec.defaultSize)
  }, [kind, spec?.defaultSize, spec?.hasSize])

  const inbound = useMemo(() => (spec ? loadChain(kind, 'issue') : []), [kind, spec, tick])
  const ready = useMemo(() => (spec ? loadLabChain(kind, 'ready') : []), [kind, spec, tick])
  const used = useMemo(() => (spec ? loadLabChain(kind, 'used') : []), [kind, spec, tick])
  const process = useMemo(() => (spec ? loadLabChain(kind, 'process') : []), [kind, spec, tick])
  const recovered = useMemo(() => (spec ? loadLabChain(kind, 'recovered') : []), [kind, spec, tick])

  const [inStart, setInStart] = useState('')
  const [inEnd, setInEnd] = useState('')
  const [inQ, setInQ] = useState('')

  const [readyDate, setReadyDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [readyQty, setReadyQty] = useState('')
  const [readySize, setReadySize] = useState('6')
  const [readyStart, setReadyStart] = useState('')
  const [readyEnd, setReadyEnd] = useState('')
  const [readyQ, setReadyQ] = useState('')

  const [useDate, setUseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [useQty, setUseQty] = useState('')
  const [useSize, setUseSize] = useState('6')
  const [useStart, setUseStart] = useState('')
  const [useEnd, setUseEnd] = useState('')
  const [useQ, setUseQ] = useState('')

  const [procDate, setProcDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [procQty, setProcQty] = useState('')
  const [procStart, setProcStart] = useState('')
  const [procEnd, setProcEnd] = useState('')
  const [procQ, setProcQ] = useState('')

  const [recDate, setRecDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [recQty, setRecQty] = useState('')
  const [recStart, setRecStart] = useState('')
  const [recEnd, setRecEnd] = useState('')
  const [recQ, setRecQ] = useState('')

  const refresh = () => setTick((t) => t + 1)

  const inFiltered = useMemo(() => filterRows(inbound, inStart, inEnd, inQ), [inbound, inStart, inEnd, inQ])
  const readyFiltered = useMemo(
    () => filterRows(ready, readyStart, readyEnd, readyQ),
    [ready, readyStart, readyEnd, readyQ],
  )
  const usedFiltered = useMemo(() => filterRows(used, useStart, useEnd, useQ), [used, useStart, useEnd, useQ])
  const procFiltered = useMemo(
    () => filterRows(process, procStart, procEnd, procQ),
    [process, procStart, procEnd, procQ],
  )
  const recFiltered = useMemo(
    () => filterRows(recovered, recStart, recEnd, recQ),
    [recovered, recStart, recEnd, recQ],
  )

  const consumed = spec?.layout === 'silver' ? sumWeights(process) : sumWeights(used)
  const onHand = sumWeights(inbound) - consumed

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

  const addBook = (book: LabBook, date: string, qty: string, size: string, clear: () => void, ok: string) => {
    const w = parseQty(qty)
    if (!date || !w) {
      toast(`Enter date and ${spec.quantityLabel.toLowerCase()}`)
      return
    }
    const existing =
      book === 'ready' ? ready : book === 'used' ? used : book === 'process' ? process : recovered
    saveLabChain(kind, book, [
      {
        id: `${book.slice(0, 2)}-${Date.now()}`,
        date,
        time: nowTime(),
        weight: w,
        size: spec.hasSize ? size : undefined,
      },
      ...existing,
    ])
    clear()
    refresh()
    toast(ok)
  }

  const editRow = (book: LabBook, rows: ChainQtyEntry[], id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const next = window.prompt(`Edit ${spec.quantityLabel.toLowerCase()} (${spec.unit})`, String(row.weight))
    if (next === null) return
    const w = Number(next)
    if (!w || w <= 0) {
      toast('Invalid quantity')
      return
    }
    saveLabChain(
      kind,
      book,
      rows.map((r) => (r.id === id ? { ...r, weight: w } : r)),
    )
    refresh()
    toast('Updated')
  }

  const deleteRow = (book: LabBook, rows: ChainQtyEntry[], id: string) => {
    if (!window.confirm('Delete this entry?')) return
    saveLabChain(
      kind,
      book,
      rows.filter((r) => r.id !== id),
    )
    refresh()
    toast('Deleted')
  }

  const returnRecovered = () => {
    const total = sumWeights(recovered)
    if (total <= 0) {
      toast('Nothing recovered to return')
      return
    }
    const amount = window.prompt(`Mass to return to store (${spec.unit})`, total.toFixed(3))
    if (amount === null) return
    const w = Number(amount)
    if (!w || w <= 0) {
      toast('Invalid quantity')
      return
    }
    const receipts = loadChain(kind, 'receipt')
    saveChain(kind, 'receipt', [
      { id: `lab-ret-${Date.now()}`, date: new Date().toISOString().slice(0, 10), time: nowTime(), weight: w },
      ...receipts,
    ])
    refresh()
    toast(`Returned ${fmtQty(w, spec.unit)} to store`)
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

  const qtyTable = (rows: ChainQtyEntry[], book: LabBook | null, allowActions: boolean) => (
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
              <td colSpan={5} className="empty-state">
                {book ? 'No entries yet' : 'Nothing received from store yet — issue it from QM Stock'}
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
                {allowActions && book ? (
                  <td>
                    <div className="qmgold-row-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          editRow(
                            book,
                            book === 'ready'
                              ? ready
                              : book === 'used'
                                ? used
                                : book === 'process'
                                  ? process
                                  : recovered,
                            r.id,
                          )
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-cn-delete btn-sm"
                        onClick={() =>
                          deleteRow(
                            book,
                            book === 'ready'
                              ? ready
                              : book === 'used'
                                ? used
                                : book === 'process'
                                  ? process
                                  : recovered,
                            r.id,
                          )
                        }
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
            <td colSpan={2}>
              <strong>{fmtQty(sumWeights(rows), spec.unit)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  const usedSection =
    spec.layout === 'silver' ? (
      <section className="qmgold-card">
        <h2>{spec.processTitle}</h2>
        <form
          className="qmgold-form-row"
          onSubmit={(e) => {
            e.preventDefault()
            addBook('process', procDate, procQty, '6', () => setProcQty(''), 'In-assay recorded')
          }}
        >
          <input type="date" value={procDate} onChange={(e) => setProcDate(e.target.value)} required />
          <input
            type="number"
            min="0"
            step={spec.step}
            placeholder={`${spec.quantityLabel} (${spec.unit})`}
            value={procQty}
            onChange={(e) => setProcQty(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-navy">
            Add
          </button>
        </form>
        <div className="qmgold-filters">
          <input type="date" value={procStart} onChange={(e) => setProcStart(e.target.value)} title="Start date" />
          <input type="date" value={procEnd} onChange={(e) => setProcEnd(e.target.value)} title="End date" />
          <input
            placeholder={`Search ${spec.quantityLabel.toLowerCase()}`}
            value={procQ}
            onChange={(e) => setProcQ(e.target.value)}
          />
        </div>
        {qtyTable(procFiltered, 'process', true)}
        <p className="qmgold-balance" style={{ marginBottom: 0 }}>
          {spec.usedTotalLabel}: {fmtQty(sumWeights(procFiltered), spec.unit)}
        </p>
      </section>
    ) : (
      <section className="qmgold-card">
        <h2>{spec.usedTitle}</h2>
        <form
          className="qmgold-form-row"
          onSubmit={(e) => {
            e.preventDefault()
            addBook('used', useDate, useQty, useSize, () => setUseQty(''), 'Assay usage recorded')
          }}
        >
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
        {qtyTable(usedFiltered, 'used', true)}
        <p className="qmgold-balance" style={{ marginBottom: 0 }}>
          {spec.usedTotalLabel}: {fmtQty(sumWeights(usedFiltered), spec.unit)}
          {spec.unit === 'mg' ? ` · ${(sumWeights(usedFiltered) / 1000).toFixed(3)} g` : ''}
        </p>
      </section>
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
        <h2>{spec.inboundTitle}</h2>
        <div className="qmgold-filters">
          <input type="date" value={inStart} onChange={(e) => setInStart(e.target.value)} title="Start date" />
          <input type="date" value={inEnd} onChange={(e) => setInEnd(e.target.value)} title="End date" />
          <input
            placeholder={`Search ${spec.quantityLabel.toLowerCase()}`}
            value={inQ}
            onChange={(e) => setInQ(e.target.value)}
          />
        </div>
        {qtyTable(inFiltered, null, false)}
      </section>

      <p className="qmgold-balance">
        {spec.onHandLabel}: {fmtQty(onHand, spec.unit)}
      </p>

      {spec.layout === 'prepared-used' || spec.layout === 'silver' ? (
        <section className="qmgold-card">
          <h2>{spec.preparedTitle}</h2>
          <form
            className="qmgold-form-row"
            onSubmit={(e) => {
              e.preventDefault()
              addBook('ready', readyDate, readyQty, readySize, () => setReadyQty(''), 'Prepared lot recorded')
            }}
          >
            <input type="date" value={readyDate} onChange={(e) => setReadyDate(e.target.value)} required />
            <input
              type="number"
              min="0"
              step={spec.step}
              placeholder={`${spec.quantityLabel} (${spec.unit})`}
              value={readyQty}
              onChange={(e) => setReadyQty(e.target.value)}
              required
            />
            {sizeSelect(readySize, setReadySize)}
            <button type="submit" className="btn btn-navy">
              Add
            </button>
          </form>
          <div className="qmgold-filters">
            <input type="date" value={readyStart} onChange={(e) => setReadyStart(e.target.value)} title="Start date" />
            <input type="date" value={readyEnd} onChange={(e) => setReadyEnd(e.target.value)} title="End date" />
            <input
              placeholder={`Search ${spec.quantityLabel.toLowerCase()}`}
              value={readyQ}
              onChange={(e) => setReadyQ(e.target.value)}
            />
          </div>
          {qtyTable(readyFiltered, 'ready', true)}
        </section>
      ) : null}

      {usedSection}

      {spec.layout === 'silver' ? (
        <section className="qmgold-card">
          <h2>{spec.recoveredTitle}</h2>
          <form
            className="qmgold-form-row"
            onSubmit={(e) => {
              e.preventDefault()
              addBook('recovered', recDate, recQty, '6', () => setRecQty(''), 'Recovery recorded')
            }}
          >
            <input type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} required />
            <input
              type="number"
              min="0"
              step={spec.step}
              placeholder={`${spec.quantityLabel} (${spec.unit})`}
              value={recQty}
              onChange={(e) => setRecQty(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-navy">
              Add
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
          {qtyTable(recFiltered, 'recovered', true)}
          <div className="labgold-actions" style={{ marginTop: '0.85rem' }}>
            <button type="button" className="btn btn-navy" onClick={returnRecovered}>
              Return to store
            </button>
          </div>
        </section>
      ) : null}

      <div className="manual-actions">
        <Link to={hubPath} className="btn btn-navy">
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
