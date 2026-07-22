import { PageHeader } from '../components/PageHeader'
import { store } from '../data/store'

export function TouchBilling() {
  const touches = store.getAll().touches
  const total = touches.reduce((s, t) => s + t.amount, 0)

  return (
    <>
      <PageHeader
        title="Touch Billing"
        subtitle="Invoice clients for touch services."
      />
      <div className="stats-row">
        <div className="stat-card">
          <span>Touch Invoices</span>
          <strong>{touches.length}</strong>
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
              </tr>
            </thead>
            <tbody>
              {touches.map((t) => (
                <tr key={t.id}>
                  <td>{t.touchNo}</td>
                  <td>{t.date}</td>
                  <td>{t.partyName}</td>
                  <td>
                    {t.metal} Touch ({t.declaredTouch})
                  </td>
                  <td>{t.weight.toFixed(2)} g</td>
                  <td>₹ {t.amount.toFixed(2)}</td>
                </tr>
              ))}
              {touches.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No touch billing records. Create entries in Touch Form.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
