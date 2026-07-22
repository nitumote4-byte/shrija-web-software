import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { store } from '../data/store'

export function TouchBilling() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const data = useMemo(() => {
    void tick
    return store.getAll()
  }, [tick])
  const touches = data.touches
  const invoiced = new Set(
    data.invoices.filter((i) => i.requestNo.startsWith('TH-')).map((i) => i.requestNo),
  )
  const total = touches.reduce((s, t) => s + t.amount, 0)
  const pending = touches.filter((t) => !invoiced.has(t.touchNo))

  const billOne = (touchNo: string) => {
    const t = touches.find((x) => x.touchNo === touchNo)
    if (!t) return
    if (invoiced.has(t.touchNo)) {
      toast('Already billed')
      return
    }
    const tax = Number((t.amount * 0.18).toFixed(2))
    store.addInvoice({
      partyName: t.partyName,
      requestNo: t.touchNo,
      amount: t.amount,
      tax,
      total: Number((t.amount + tax).toFixed(2)),
      status: 'Unpaid',
    })
    setTick((n) => n + 1)
    toast(`Invoice for ${t.touchNo} created`)
  }

  const billAll = () => {
    if (pending.length === 0) {
      toast('No pending touch invoices')
      return
    }
    for (const t of pending) {
      const tax = Number((t.amount * 0.18).toFixed(2))
      store.addInvoice({
        partyName: t.partyName,
        requestNo: t.touchNo,
        amount: t.amount,
        tax,
        total: Number((t.amount + tax).toFixed(2)),
        status: 'Unpaid',
      })
    }
    setTick((n) => n + 1)
    toast(`Billed ${pending.length} touch record(s)`)
  }

  return (
    <>
      <PageHeader
        title="Touch Billing"
        subtitle="Invoice clients for touch services."
        actions={
          <button type="button" className="btn btn-gold" onClick={billAll}>
            Bill All Pending
          </button>
        }
      />
      <div className="stats-row">
        <div className="stat-card">
          <span>Touch Records</span>
          <strong>{touches.length}</strong>
        </div>
        <div className="stat-card">
          <span>Pending Bills</span>
          <strong>{pending.length}</strong>
        </div>
        <div className="stat-card">
          <span>Total Touch Fees</span>
          <strong>₹ {total.toLocaleString('en-IN')}</strong>
        </div>
      </div>
      <div className="panel">
        <h2>Touch Billing Register</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Touch No</th>
                <th>Date</th>
                <th>Party</th>
                <th>Service</th>
                <th>Weight</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {touches.map((t) => {
                const done = invoiced.has(t.touchNo)
                return (
                  <tr key={t.id}>
                    <td>{t.touchNo}</td>
                    <td>{t.date}</td>
                    <td>{t.partyName}</td>
                    <td>
                      {t.metal} Touch ({t.declaredTouch})
                    </td>
                    <td>{t.weight.toFixed(2)} g</td>
                    <td>₹ {t.amount.toFixed(2)}</td>
                    <td>{done ? 'Invoiced' : 'Pending'}</td>
                    <td>
                      {!done && (
                        <button type="button" className="btn btn-navy" onClick={() => billOne(t.touchNo)}>
                          Bill
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {touches.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No touch billing records. Create entries in Touch Form.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {Toast}
    </>
  )
}
