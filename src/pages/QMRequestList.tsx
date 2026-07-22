import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { statusBadge } from '../components/ui'
import { store } from '../data/store'

export function QMRequestList() {
  const requests = store.getAll().requests
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const matchQ =
        !q ||
        r.requestNo.toLowerCase().includes(q.toLowerCase()) ||
        r.partyName.toLowerCase().includes(q.toLowerCase())
      const matchS = status === 'All' || r.status === status
      return matchQ && matchS
    })
  }, [requests, q, status])

  return (
    <>
      <PageHeader
        title="QM Request List"
        subtitle="Overall branch operations monitoring."
      />
      <div className="panel">
        <h2>Search & Filter</h2>
        <div className="form-grid">
          <div className="field">
            <label>Search party / request</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to filter..."
            />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {[
                'All',
                'Pending',
                'In Progress',
                'Assayed',
                'Hallmarked',
                'Billed',
                'Delivered',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="panel">
        <h2>
          Results ({filtered.length})
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Request</th>
                <th>Party</th>
                <th>Category</th>
                <th>Purity</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.requestNo}</td>
                  <td>{r.partyName}</td>
                  <td>{r.categoryName}</td>
                  <td>{r.purity}</td>
                  <td>{r.weight.toFixed(2)} g</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>{r.remarks || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No matching requests
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
