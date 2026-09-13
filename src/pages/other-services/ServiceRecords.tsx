import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { statusBadge, useToast } from '../../components/ui'
import { store } from '../../data/store'
import {
  formatOtherServiceLineQuantity,
  formatOtherServiceQuantity,
  otherServiceLineItemsOf,
  PAYMENT_MODES,
  summarizeOtherServiceItems,
  totalWeightOf,
  type OtherService,
  type OtherServicePaymentMode,
  type OtherServicePaymentStatus,
} from '../../data/otherServices'
import { openOtherServiceReceiptPrint, previewOtherServiceReceipt } from '../../utils/otherServiceReceiptPrint'
import './other-services.css'

function money(n: number) {
  return `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function qtyCell(row: OtherService) {
  const items = otherServiceLineItemsOf(row)
  if (items.length) {
    if (row.kind === 'weight' || items.some((item) => item.unit === 'GM' || item.unit === 'KG')) {
      return totalWeightOf(items).label
    }
    const pcs = items.reduce((sum, item) => sum + item.quantity, 0)
    return `${pcs} pcs`
  }
  return formatOtherServiceQuantity(row.quantity, row.unit)
}

function itemCell(row: OtherService) {
  const items = otherServiceLineItemsOf(row)
  if (items.length) return summarizeOtherServiceItems(items)
  return row.item || row.productDescription || '—'
}

export function ServiceRecords() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const data = store.getAll()
  void tick
  const types = store.getOtherServiceTypes(true)
  const [slip, setSlip] = useState('')
  const [customer, setCustomer] = useState('')
  const [contact, setContact] = useState('')
  const [typeId, setTypeId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState<'all' | OtherServicePaymentMode>('all')
  const [pay, setPay] = useState<'all' | OtherServicePaymentStatus>('all')
  const [minAmt, setMinAmt] = useState('')
  const [maxAmt, setMaxAmt] = useState('')
  const [view, setView] = useState<OtherService | null>(null)

  const rows = useMemo(() => {
    return (data.otherServices || []).filter((r) => {
      if (slip && !r.slipNo.toLowerCase().includes(slip.trim().toLowerCase())) return false
      if (customer && !r.customerName.toLowerCase().includes(customer.trim().toLowerCase())) return false
      if (contact && !r.contactNo.includes(contact.trim())) return false
      if (typeId !== 'all' && r.typeId !== typeId) return false
      if (from && r.date < from) return false
      if (to && r.date > to) return false
      if (mode !== 'all' && r.paymentMode !== mode) return false
      if (pay !== 'all' && r.paymentStatus !== pay) return false
      const amt = r.totalAmount
      if (minAmt && amt < Number(minAmt)) return false
      if (maxAmt && amt > Number(maxAmt)) return false
      return true
    })
  }, [data.otherServices, slip, customer, contact, typeId, from, to, mode, pay, minAmt, maxAmt])

  const printRow = (row: OtherService, reprint: boolean) => {
    const marked = store.markOtherServiceReceiptPrinted(row.id, reprint)
    if (!marked.ok) {
      toast(marked.error)
      return
    }
    const next = marked.service
    const ok = openOtherServiceReceiptPrint(next, reprint)
    if (!ok) toast('Allow pop-ups to print the receipt')
    setTick((n) => n + 1)
  }

  const cancel = (row: OtherService) => {
    if (row.status === 'Cancelled') return
    if (!window.confirm(`Cancel slip ${row.slipNo}? The record stays for audit.`)) return
    const result = store.cancelOtherService(row.id)
    if (!result.ok) {
      toast(result.error)
      return
    }
    toast(`Cancelled ${row.slipNo}`)
    setTick((n) => n + 1)
  }

  return (
    <div className="os-page">
      <PageHeader title="Service Records" subtitle="Search other service slips. Cancelled rows remain auditable." />
      <div className="os-card">
        <div className="os-filters">
          <div className="field">
            <label>Slip No.</label>
            <input value={slip} onChange={(e) => setSlip(e.target.value)} />
          </div>
          <div className="field">
            <label>Customer</label>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
          <div className="field">
            <label>Contact</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="field">
            <label>Service Type</label>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="all">All</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label>Payment Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="all">All</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Paid / Pending</label>
            <select value={pay} onChange={(e) => setPay(e.target.value as typeof pay)}>
              <option value="all">All</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="field">
            <label>Min Amount</label>
            <input type="number" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} />
          </div>
          <div className="field">
            <label>Max Amount</label>
            <input type="number" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slip No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Service</th>
                <th>Item/Product</th>
                <th>Weight/Pieces</th>
                <th>Amount</th>
                <th>Received</th>
                <th>Pending</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="empty-state">
                    No service records
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.slipNo}</td>
                    <td>{r.date}</td>
                    <td>{r.customerName}</td>
                    <td>{r.contactNo}</td>
                    <td>{r.typeName}</td>
                    <td>{itemCell(r)}</td>
                    <td>{qtyCell(r)}</td>
                    <td>{money(r.totalAmount)}</td>
                    <td>{money(r.amountReceived)}</td>
                    <td>{money(r.pendingAmount)}</td>
                    <td>{r.paymentMode}</td>
                    <td>
                      {statusBadge(r.status === 'Cancelled' ? 'Cancelled' : r.paymentStatus)}
                    </td>
                    <td>
                      <div className="os-row-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setView(r)}>
                          View
                        </button>
                        {r.status !== 'Cancelled' ? (
                          <>
                            <Link className="btn btn-ghost" to={`/other-services/entry?id=${r.id}`}>
                              Edit
                            </Link>
                            <Link className="btn btn-ghost" to={`/other-services/entry?payment=${r.id}`}>
                              Payment
                            </Link>
                            <button type="button" className="btn btn-navy" onClick={() => printRow(r, false)}>
                              Print
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => printRow(r, true)}>
                              Reprint
                            </button>
                            <button type="button" className="btn" onClick={() => cancel(r)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" className="btn btn-ghost" onClick={() => previewOtherServiceReceipt(r, true)}>
                            Preview
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {view ? (
        <div className="os-card">
          <h2>{view.slipNo}</h2>
          <p>
            {view.customerName} · {view.contactNo} · {view.typeName}
          </p>
          <p>
            {qtyCell(view)} · {money(view.totalAmount)} · {view.paymentStatus}
          </p>
          {otherServiceLineItemsOf(view).length ? (
            <div className="os-view-items">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>{view.kind === 'weight' ? 'Weight' : 'Qty'}</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {otherServiceLineItemsOf(view).map((item, i) => (
                    <tr key={item.id || `${item.description}-${i}`}>
                      <td>{item.description}</td>
                      <td>
                        {view.kind === 'weight' || item.unit === 'GM' || item.unit === 'KG'
                          ? formatOtherServiceLineQuantity(item)
                          : `${item.quantity} pcs`}
                      </td>
                      <td>{money(item.rate)}</td>
                      <td>{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="os-muted">{formatOtherServiceQuantity(view.quantity, view.unit)}</p>
          )}
          <div className="os-actions">
            <button type="button" className="btn btn-navy" onClick={() => printRow(view, false)}>
              Print
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => previewOtherServiceReceipt(view, false)}>
              Preview
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setView(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
      {Toast}
    </div>
  )
}
