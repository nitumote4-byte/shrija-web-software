import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { statusBadge, useToast } from '../components/ui'
import { store, type HallmarkRequest } from '../data/store'

const STATUSES: HallmarkRequest['status'][] = [
  'Pending',
  'In Progress',
  'Assayed',
  'Hallmarked',
  'Billed',
  'Delivered',
]

export function QMRequestList() {
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)
  const requests = store.getAll().requests
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  void tick

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

  const setRowStatus = (id: string, next: HallmarkRequest['status']) => {
    store.updateRequestStatus(id, next)
    // Mirror on rough sheet when hallmarking completes
    const req = store.getAll().requests.find((r) => r.id === id)
    if (req?.requestNo && next === 'Hallmarked') {
      const rough = store.getAll().roughSheets.filter((r) => r.requestNo === req.requestNo)
      if (rough.length) {
        store.updateRoughSheetStatus(
          rough.map((r) => r.id),
          'Completed',
        )
      }
    }
    setTick((t) => t + 1)
    toast(`Status → ${next}`)
  }

  return (
    <>
      <PageHeader
        title="QM Request List"
        subtitle="Overall branch operations — advance job status toward billing."
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
              {['All', ...STATUSES].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="panel">
        <h2>Results ({filtered.length})</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Request</th>
                <th>Party</th>
                <th>Item</th>
                <th>Category</th>
                <th>Purity</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Advance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.requestNo}</td>
                  <td>{r.partyName}</td>
                  <td>{r.item || '—'}</td>
                  <td>{r.categoryName}</td>
                  <td>{r.purity}</td>
                  <td>{r.weight.toFixed(2)} g</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>
                    <select
                      className="auto-night-select"
                      value={r.status}
                      onChange={(e) =>
                        setRowStatus(r.id, e.target.value as HallmarkRequest['status'])
                      }
                      aria-label={`Status for ${r.requestNo}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-state">
                    No matching requests
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
