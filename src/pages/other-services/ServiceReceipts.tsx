import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/ui'
import { store } from '../../data/store'
import { openOtherServiceReceiptPrint, previewOtherServiceReceipt } from '../../utils/otherServiceReceiptPrint'
import './other-services.css'

function money(n: number) {
  return `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ServiceReceipts() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const [q, setQ] = useState('')
  const data = store.getAll()
  void tick

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data.otherServiceReceipts || []).filter((r) => {
      const svc = (data.otherServices || []).find((x) => x.id === r.serviceId)
      if (!s) return true
      return (
        r.receiptNo.toLowerCase().includes(s) ||
        r.slipNo.toLowerCase().includes(s) ||
        (svc?.customerName || '').toLowerCase().includes(s)
      )
    })
  }, [data.otherServiceReceipts, data.otherServices, q])

  const act = (serviceId: string, reprint: boolean, preview: boolean) => {
    const svc = (store.getAll().otherServices || []).find((x) => x.id === serviceId)
    if (preview) {
      if (!svc) {
        toast('Service not found')
        return
      }
      const ok = previewOtherServiceReceipt(svc, reprint)
      if (!ok) toast('Allow pop-ups to preview the receipt')
      return
    }
    const marked = store.markOtherServiceReceiptPrinted(serviceId, reprint)
    if (!marked.ok) {
      toast(marked.error)
      return
    }
    const ok = openOtherServiceReceiptPrint(marked.service, reprint)
    if (!ok) toast('Allow pop-ups to print the receipt')
    setTick((n) => n + 1)
  }

  return (
    <div className="os-page">
      <PageHeader title="Other Service Receipts" subtitle="Print and reprint do not create another Fund & Trace entry." />
      <div className="os-card">
        <div className="field">
          <label>Search receipt / slip / customer</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Slip No.</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Reprints</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No receipts yet
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const svc = (data.otherServices || []).find((x) => x.id === r.serviceId)
                  return (
                    <tr key={r.id}>
                      <td>{r.receiptNo}</td>
                      <td>{r.slipNo}</td>
                      <td>{svc?.customerName || '—'}</td>
                      <td>{svc ? money(svc.totalAmount) : '—'}</td>
                      <td>{r.reprintCount}</td>
                      <td>
                        <div className="os-row-actions">
                          <button type="button" className="btn btn-ghost" onClick={() => act(r.serviceId, false, true)}>
                            Preview
                          </button>
                          <button type="button" className="btn btn-navy" onClick={() => act(r.serviceId, false, false)}>
                            Print
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => act(r.serviceId, true, false)}>
                            Reprint
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {Toast}
    </div>
  )
}
