import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { store } from '../../data/store'
import { PAYMENT_MODES, reportBucketForService, type OtherService } from '../../data/otherServices'
import './other-services.css'

function money(n: number) {
  return `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeek(d: Date) {
  const next = new Date(d)
  const day = next.getDay()
  const diff = day === 0 ? 6 : day - 1
  next.setDate(next.getDate() - diff)
  return next
}

type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

function rangeFor(key: RangeKey, from: string, to: string): { start: string; end: string } {
  const now = new Date()
  if (key === 'today') {
    const d = isoDate(now)
    return { start: d, end: d }
  }
  if (key === 'yesterday') {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    const d = isoDate(y)
    return { start: d, end: d }
  }
  if (key === 'week') {
    const start = startOfWeek(now)
    return { start: isoDate(start), end: isoDate(now) }
  }
  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: isoDate(start), end: isoDate(now) }
  }
  return { start: from || '0000-01-01', end: to || '9999-12-31' }
}

function activeRows(rows: OtherService[], start: string, end: string) {
  return rows.filter((r) => r.status !== 'Cancelled' && r.date >= start && r.date <= end)
}

export function OtherServicesReports() {
  const data = store.getAll()
  const [key, setKey] = useState<RangeKey>('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const range = rangeFor(key, from, to)
  const rows = activeRows(data.otherServices || [], range.start, range.end)

  const summary = useMemo(() => {
    return {
      count: rows.length,
      revenue: rows.reduce((s, r) => s + r.totalAmount, 0),
      received: rows.reduce((s, r) => s + r.amountReceived, 0),
      pending: rows.reduce((s, r) => s + r.pendingAmount, 0),
    }
  }, [rows])

  const byService = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number; received: number; pending: number }>()
    const order = ['Vibrator', 'Silver Polish', 'Laser Soldering', 'Manual Services']
    for (const label of order) map.set(label, { count: 0, revenue: 0, received: 0, pending: 0 })
    for (const r of rows) {
      const bucket = reportBucketForService(r)
      const cur = map.get(bucket) || { count: 0, revenue: 0, received: 0, pending: 0 }
      cur.count += 1
      cur.revenue += r.totalAmount
      cur.received += r.amountReceived
      cur.pending += r.pendingAmount
      map.set(bucket, cur)
    }
    return [...map.entries()]
  }, [rows])

  const byPay = useMemo(() => {
    return PAYMENT_MODES.map((mode) => {
      const list = rows.filter((r) => r.paymentMode === mode)
      return {
        mode,
        count: list.length,
        received: list.reduce((s, r) => s + r.amountReceived, 0),
      }
    })
  }, [rows])

  return (
    <div className="os-page">
      <PageHeader
        title="Other Services Reports"
        subtitle="Hallmarking income is not included. Combined cash is visible in Fund & Trace."
      />
      <div className="os-card">
        <div className="os-filters">
          <div className="field">
            <label>Period</label>
            <select value={key} onChange={(e) => setKey(e.target.value as RangeKey)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
          {key === 'custom' ? (
            <>
              <div className="field">
                <label>From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field">
                <label>To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          ) : null}
        </div>
        <div className="os-totals">
          <div className="os-total">
            <span>Total Service Entries</span>
            <strong>{summary.count}</strong>
          </div>
          <div className="os-total">
            <span>Total Revenue</span>
            <strong>{money(summary.revenue)}</strong>
          </div>
          <div className="os-total">
            <span>Total Received</span>
            <strong>{money(summary.received)}</strong>
          </div>
          <div className="os-total">
            <span>Total Pending</span>
            <strong>{money(summary.pending)}</strong>
          </div>
        </div>
      </div>
      <div className="os-card">
        <h2>Service-wise</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Entries</th>
                <th>Revenue</th>
                <th>Received</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {byService.map(([name, v]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{v.count}</td>
                  <td>{money(v.revenue)}</td>
                  <td>{money(v.received)}</td>
                  <td>{money(v.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="os-card">
        <h2>Payment-wise</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mode</th>
                <th>Entries</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {byPay.map((r) => (
                <tr key={r.mode}>
                  <td>{r.mode}</td>
                  <td>{r.count}</td>
                  <td>{money(r.received)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
