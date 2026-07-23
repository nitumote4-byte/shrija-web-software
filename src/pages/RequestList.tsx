import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CloudUpload } from 'lucide-react'
import { useToast } from '../components/ui'
import { store, type RoughSheetEntry } from '../data/store'

type SheetRow = RoughSheetEntry & {
  checked: boolean
  dirty?: boolean
}

function toSheetRows(entries: RoughSheetEntry[]): SheetRow[] {
  return entries.map((r) => ({
    ...r,
    jobCardNo: r.jobCardNo || '',
    jobCardSaved: Boolean(r.jobCardSaved),
    co: r.co || '',
    sampleTagId: r.sampleTagId || '',
    sampleQty: r.sampleQty ?? 1,
    cornet: r.cornet ?? 0,
    rejectPic: r.rejectPic ?? 0,
    checked: false,
    dirty: false,
  }))
}

function persistRow(row: SheetRow, markJobSaved: boolean) {
  const jobCardNo = (row.jobCardNo || '').trim()
  store.updateRoughSheetRow(row.id, {
    jobCardNo,
    jobCardSaved: markJobSaved ? Boolean(jobCardNo) : Boolean(row.jobCardSaved && jobCardNo),
    co: row.co,
    sampleWeight: Number(row.sampleWeight) || 0,
    sampleQty: Number(row.sampleQty) || 0,
    sampleTagId: row.sampleTagId,
    samplingMethod: row.samplingMethod,
    cornet: Number(row.cornet) || 0,
    rejectPic: Number(row.rejectPic) || 0,
    weight: Number(row.weight) || 0,
  })
}

/**
 * Gold Shark Daily Sheet / Request List:
 * Saved Manual/Auto requests appear here with editable fields.
 * Job Card No is mandatory — Save first, then Complete.
 */
export function RequestList() {
  const { toast, Toast } = useToast()

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState('Day')
  const [metal, setMetal] = useState('')
  const [purity, setPurity] = useState('')
  const [status, setStatus] = useState('')
  const [requestNo, setRequestNo] = useState('')
  const [jobCardQ, setJobCardQ] = useState('')
  const [tick, setTick] = useState(0)
  const [rows, setRows] = useState<SheetRow[]>(() => toSheetRows(store.getAll().roughSheets))

  const reload = () => {
    setRows(toSheetRows(store.getAll().roughSheets))
    setTick((t) => t + 1)
  }

  void tick

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (date && r.date !== date) return false
      if (shift && r.shift !== shift) return false
      if (purity && r.purity !== purity) return false
      if (status && r.status !== status) return false
      if (metal) {
        const m = r.purity === '925' ? 'Silver' : 'Gold'
        if (m !== metal) return false
      }
      if (requestNo && !(r.requestNo || '').toLowerCase().includes(requestNo.trim().toLowerCase())) {
        return false
      }
      if (jobCardQ && !(r.jobCardNo || '').toLowerCase().includes(jobCardQ.trim().toLowerCase())) {
        return false
      }
      return true
    })
  }, [rows, date, shift, metal, purity, status, requestNo, jobCardQ])

  const allChecked = filtered.length > 0 && filtered.every((r) => r.checked)
  const selected = filtered.filter((r) => r.checked)
  const selectedIds = selected.map((r) => r.id)

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.pic += r.pic
        acc.weight += r.weight
        acc.sampleQty += r.sampleQty
        acc.cornet += Number(r.cornet) || 0
        acc.rejectPic += Number(r.rejectPic) || 0
        return acc
      },
      { pic: 0, weight: 0, sampleQty: 0, cornet: 0, rejectPic: 0 },
    )
  }, [filtered])

  const patchRow = (id: string, patch: Partial<SheetRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        const dataChanged = Object.keys(patch).some((k) => k !== 'checked')
        if (dataChanged) {
          next.dirty = true
          if (patch.jobCardNo !== undefined) next.jobCardSaved = false
        }
        return next
      }),
    )
  }

  const toggleAll = (checked: boolean) => {
    const ids = new Set(filtered.map((r) => r.id))
    setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, checked } : r)))
  }

  const saveRow = (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const jc = (row.jobCardNo || '').trim()
    if (!jc) {
      toast('Job Card No is mandatory — enter Job Card, then Save')
      return
    }
    persistRow(row, true)
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, dirty: false, jobCardSaved: true, jobCardNo: jc } : r)),
    )
    toast('Row saved')
  }

  const saveAll = () => {
    const targets = filtered.filter((r) => r.checked || r.dirty || !r.jobCardSaved)
    const list = targets.length ? targets : filtered
    const missing = list.filter((r) => !(r.jobCardNo || '').trim())
    if (missing.length) {
      toast(`Job Card No is mandatory on ${missing.length} row(s) — fill and Save first`)
      return
    }
    for (const row of list) persistRow(row, true)
    reload()
    toast(`Saved ${list.length} row(s)`)
  }

  const completeSelected = () => {
    if (selectedIds.length === 0) {
      toast('Select at least one row')
      return
    }
    const noJob = selected.filter((r) => !(r.jobCardNo || '').trim())
    if (noJob.length) {
      toast('Job Card No is mandatory — enter Job Card, Save, then Complete')
      return
    }
    const unsaved = selected.filter((r) => r.dirty || !r.jobCardSaved)
    if (unsaved.length) {
      toast('Save Job Card first, then Complete')
      return
    }
    store.updateRoughSheetStatus(selectedIds, 'Completed')
    reload()
    toast(`${selectedIds.length} row(s) completed`)
  }

  const rejectSelected = () => {
    if (selectedIds.length === 0) {
      toast('Select at least one row')
      return
    }
    store.updateRoughSheetStatus(selectedIds, 'Rejected')
    reload()
    toast(`${selectedIds.length} row(s) rejected`)
  }

  const weighRow = (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const captured = Number((0.2 + Math.random() * 0.6).toFixed(3))
    patchRow(id, { sampleWeight: captured })
    toast(`Weighing captured: ${captured} g`)
  }

  return (
    <div className="reqlist-page">
      <div className="reqlist-filters">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={shift} onChange={(e) => setShift(e.target.value)}>
          <option value="">Select Shift</option>
          <option value="Day">Day</option>
          <option value="Night">Night</option>
        </select>
        <select value={metal} onChange={(e) => setMetal(e.target.value)}>
          <option value="">Select Metal</option>
          <option value="Gold">Gold</option>
          <option value="Silver">Silver</option>
        </select>
        <select value={purity} onChange={(e) => setPurity(e.target.value)}>
          <option value="">Select Purity</option>
          {['999', '916', '750', '585', '925'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          placeholder="Request number"
          value={requestNo}
          onChange={(e) => setRequestNo(e.target.value)}
        />
        <input
          placeholder="Job card number"
          value={jobCardQ}
          onChange={(e) => setJobCardQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Select Status</option>
          <option value="Pending">Pending</option>
          <option value="Accepted">Accepted</option>
          <option value="Completed">Completed</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <div className="reqlist-actions">
        <button type="button" className="btn btn-navy" onClick={rejectSelected}>
          Reject
        </button>
        <button type="button" className="btn btn-navy" onClick={completeSelected}>
          Complete
        </button>
        <button type="button" className="btn btn-navy" onClick={saveAll}>
          Save All
        </button>
      </div>

      <p className="reqlist-hint">
        Job Card No is mandatory. Enter Job Card → <strong>Save</strong> / Save All → then{' '}
        <strong>Complete</strong>.
      </p>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap reqlist-table-wrap">
          <table className="data-table navy-head-table reqlist-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => toggleAll(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th>Party Name</th>
                <th>C/O</th>
                <th>Item Name</th>
                <th>Pic</th>
                <th>Weight</th>
                <th>Purity</th>
                <th>Request No</th>
                <th>Job Card No *</th>
                <th>Sample Weight</th>
                <th>Sample Qty</th>
                <th>Sample Tag Id</th>
                <th>Method</th>
                <th>Cornet</th>
                <th>Reject Pic</th>
                <th>Weighing</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={17} className="empty-state">
                    No records found — save Manual/Auto Request to populate this day sheet.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className={r.dirty ? 'reqlist-dirty' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.checked}
                        onChange={(e) => patchRow(r.id, { checked: e.target.checked })}
                      />
                    </td>
                    <td>{r.partyName}</td>
                    <td>
                      <input
                        className="table-input"
                        value={r.co || ''}
                        onChange={(e) => patchRow(r.id, { co: e.target.value })}
                      />
                    </td>
                    <td>{r.item}</td>
                    <td>{r.pic}</td>
                    <td>{r.weight.toFixed(3)}</td>
                    <td>{r.purity}</td>
                    <td>{r.requestNo || '—'}</td>
                    <td>
                      <input
                        className={`table-input reqlist-jobcard ${!(r.jobCardNo || '').trim() ? 'reqlist-jobcard-missing' : ''}`}
                        value={r.jobCardNo || ''}
                        onChange={(e) => patchRow(r.id, { jobCardNo: e.target.value })}
                        placeholder="Job card *"
                        required
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        step="0.001"
                        value={r.sampleWeight}
                        onChange={(e) =>
                          patchRow(r.id, { sampleWeight: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        value={r.sampleQty}
                        onChange={(e) =>
                          patchRow(r.id, { sampleQty: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={r.sampleTagId || ''}
                        onChange={(e) => patchRow(r.id, { sampleTagId: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={r.samplingMethod || ''}
                        onChange={(e) => patchRow(r.id, { samplingMethod: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input reqlist-cornet"
                        type="number"
                        step="0.001"
                        value={Number(r.cornet || 0)}
                        onChange={(e) =>
                          patchRow(r.id, { cornet: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        value={r.rejectPic ?? 0}
                        onChange={(e) =>
                          patchRow(r.id, { rejectPic: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="reqlist-weigh"
                        title="Capture weighing"
                        onClick={() => weighRow(r.id)}
                      >
                        <CloudUpload size={18} />
                      </button>
                    </td>
                    <td>
                      {(r.dirty || !r.jobCardSaved) && (
                        <button
                          type="button"
                          className="btn btn-navy reqlist-save"
                          onClick={() => saveRow(r.id)}
                        >
                          Save
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="reqlist-totals">
                  <td colSpan={4}>
                    <strong>Totals:</strong>
                  </td>
                  <td>
                    <strong>{totals.pic}</strong>
                  </td>
                  <td>
                    <strong>{totals.weight.toFixed(3)}</strong>
                  </td>
                  <td colSpan={4} />
                  <td>
                    <strong>{totals.sampleQty}</strong>
                  </td>
                  <td colSpan={2} />
                  <td>
                    <strong>{totals.cornet.toFixed(3)}</strong>
                  </td>
                  <td>
                    <strong>{totals.rejectPic}</strong>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="manual-actions">
        <Link to="/" className="btn btn-reset">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
