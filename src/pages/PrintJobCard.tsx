import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { store } from '../data/store'
import { getFirmName } from '../data/firmProfile'

export function PrintJobCard() {
  const requests = store.getAll().requests
  const [requestNo, setRequestNo] = useState(requests[0]?.requestNo ?? '')
  const selected = useMemo(
    () => requests.find((r) => r.requestNo === requestNo),
    [requests, requestNo],
  )

  return (
    <>
      <PageHeader
        title="Print Job Card"
        subtitle="Print detailed job tracking cards."
        actions={
          <button type="button" className="btn btn-gold no-print" onClick={() => window.print()}>
            Print Card
          </button>
        }
      />
      <div className="panel no-print">
        <h2>Select Request</h2>
        <div className="form-grid">
          <div className="field">
            <label>Request No</label>
            <select value={requestNo} onChange={(e) => setRequestNo(e.target.value)}>
              {requests.map((r) => (
                <option key={r.id} value={r.requestNo}>
                  {r.requestNo} — {r.partyName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selected && (
        <div className="job-card-preview">
          <h3>{getFirmName()}</h3>
          <div className="meta">Job Tracking Card</div>
          <dl>
            <div>
              <dt>Request No</dt>
              <dd>{selected.requestNo}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{selected.date}</dd>
            </div>
            <div>
              <dt>Party</dt>
              <dd>{selected.partyName}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{selected.categoryName}</dd>
            </div>
            <div>
              <dt>Purity</dt>
              <dd>{selected.purity}</dd>
            </div>
            <div>
              <dt>Pieces</dt>
              <dd>{selected.pieces}</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>{selected.weight.toFixed(2)} g</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
          </dl>
          <p style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Remarks: {selected.remarks || 'None'}
          </p>
        </div>
      )}
    </>
  )
}
