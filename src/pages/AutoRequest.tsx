import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ui'
import { store, type PendingRoughRequest } from '../data/store'

export function AutoRequest() {
  const { toast, Toast } = useToast()
  const [night, setNight] = useState('Night')
  const [rows, setRows] = useState<PendingRoughRequest[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const timerRef = useRef<number | null>(null)

  const stopFetching = (silent = false) => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setFetching(false)
    if (!silent) toast('Fetching stopped')
  }

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current)
    }
  }, [])

  const pullOne = () => {
    const entry = store.fetchAutoRoughBatch(night)
    setRows((prev) => {
      if (prev.some((r) => r.id === entry.id)) return prev
      return [entry, ...prev]
    })
  }

  const fetchRequest = () => {
    if (fetching) {
      toast('Already fetching…')
      return
    }
    setFetching(true)
    pullOne()
    timerRef.current = window.setInterval(pullOne, 2200)
    toast('Fetching auto requests…')
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    if (selected.length === rows.length) setSelected([])
    else setSelected(rows.map((r) => r.id))
  }

  const saveRequest = () => {
    if (selected.length === 0) {
      toast('Please check at least one request')
      return
    }
    const created = store.saveAutoRequests({ night, selectedIds: selected })
    setRows((prev) => prev.filter((r) => !selected.includes(r.id)))
    setSelected([])
    toast(`${created.length} auto request(s) saved`)
  }

  return (
    <div className="auto-request-page">
      <div className="auto-top-bar">
        <select
          className="auto-night-select"
          value={night}
          onChange={(e) => setNight(e.target.value)}
        >
          <option value="Night">Night</option>
          <option value="Day">Day</option>
        </select>
        {fetching && <span className="fetching-pill">Fetching…</span>}
      </div>

      <div className="panel auto-table-panel">
        <div className="table-wrap">
          <table className="data-table navy-head-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.length === rows.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />{' '}
                  Check
                </th>
                <th>Party Name</th>
                <th>Item</th>
                <th>PIC</th>
                <th>Weight</th>
                <th>Purity</th>
                <th>Request No</th>
                <th>Receipt No</th>
                <th>Job Card No</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-state">
                    &nbsp;
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={selected.includes(row.id) ? 'row-selected' : ''}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.requestNo}`}
                      />
                    </td>
                    <td>{row.partyName}</td>
                    <td>{row.item}</td>
                    <td>{row.pic}</td>
                    <td>{row.weight.toFixed(2)}</td>
                    <td>{row.purity}</td>
                    <td>{row.requestNo}</td>
                    <td>{row.receiptNo}</td>
                    <td>{row.jobCardNo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="auto-actions">
        <div className="auto-action-row">
          <button type="button" className="btn btn-navy" onClick={saveRequest}>
            Save Request
          </button>
          <button type="button" className="btn btn-navy" onClick={fetchRequest}>
            Fetch Request
          </button>
          <button
            type="button"
            className="btn btn-navy"
            onClick={() => stopFetching()}
            disabled={!fetching}
          >
            Stop Fetching
          </button>
        </div>
        <Link to="/" className="btn btn-back">
          Back
        </Link>
      </div>

      {Toast}
    </div>
  )
}
