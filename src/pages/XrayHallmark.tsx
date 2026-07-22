import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/ui'
import { store } from '../data/store'

export function XrayHallmark() {
  const [tick, setTick] = useState(0)
  const data = store.getAll()
  const { toast, Toast } = useToast()
  const [requestNo, setRequestNo] = useState(data.requests[0]?.requestNo ?? '')
  const [reading, setReading] = useState('')
  const [purity, setPurity] = useState('916')
  void tick

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const req = data.requests.find((r) => r.requestNo === requestNo)
    if (!req || !reading) return
    store.addXray({
      requestNo,
      partyName: req.partyName,
      reading: Number(reading),
      purity,
    })
    setTick((t) => t + 1)
    toast('X-Ray hallmark entry saved')
    setReading('')
  }

  const rows = store.getAll().xray

  return (
    <>
      <PageHeader
        title="X-Ray Hallmark Sheet"
        subtitle="Manage additional hallmarking data."
      />
      <div className="panel">
        <h2>New XRF Reading</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>Request</label>
              <select value={requestNo} onChange={(e) => setRequestNo(e.target.value)}>
                {data.requests.map((r) => (
                  <option key={r.id} value={r.requestNo}>
                    {r.requestNo} — {r.partyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>XRF Reading</label>
              <input
                type="number"
                step="0.01"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Declared Purity</label>
              <select value={purity} onChange={(e) => setPurity(e.target.value)}>
                {['999', '916', '750', '585', '925'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Reading
            </button>
          </div>
        </form>
      </div>
      <div className="panel">
        <h2>X-Ray Sheet Records</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sheet</th>
                <th>Date</th>
                <th>Request</th>
                <th>Party</th>
                <th>Reading</th>
                <th>Purity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.sheetNo}</td>
                  <td>{r.date}</td>
                  <td>{r.requestNo}</td>
                  <td>{r.partyName}</td>
                  <td>{r.reading.toFixed(2)}</td>
                  <td>{r.purity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {Toast}
    </>
  )
}
