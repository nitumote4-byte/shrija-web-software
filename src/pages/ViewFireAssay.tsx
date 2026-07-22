import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import { tenantSet } from '../data/tenant'

type ViewRow = {
  key: string
  sampleDrawn: string
  jobCardNo: string
  sampleWeight: string
  silver: string
  lead: string
  wotgcaa: string
  fineness: string
  meanFineness: string
  locked?: boolean
}

function emptyRow(key: string, patch: Partial<ViewRow> = {}): ViewRow {
  return {
    key,
    sampleDrawn: '',
    jobCardNo: '',
    sampleWeight: '',
    silver: '',
    lead: '',
    wotgcaa: '',
    fineness: '',
    meanFineness: '',
    ...patch,
  }
}

function controlRows(mode: 'CG' | 'Cornet'): ViewRow[] {
  if (mode === 'Cornet') {
    return [
      emptyRow('cg1', { jobCardNo: 'CG1', fineness: 'Copper 1', locked: true }),
      emptyRow('cg2', { jobCardNo: 'CG2', fineness: 'Copper 2', locked: true }),
    ]
  }
  return [
    emptyRow('cg1', { jobCardNo: 'CG1', fineness: 'CG Ref 1', locked: true }),
    emptyRow('cg2', { jobCardNo: 'CG2', fineness: 'CG Ref 2', locked: true }),
  ]
}

export function ViewFireAssay() {
  const data = store.getAll()
  const { toast, Toast } = useToast()

  const [jobCard, setJobCard] = useState('')
  const [purityFilter, setPurityFilter] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState('')
  const [sheetNo, setSheetNo] = useState('')
  const [mode, setMode] = useState<'CG' | 'Cornet'>('Cornet')

  const [purity, setPurity] = useState('')
  const [delta1, setDelta1] = useState('')
  const [delta2, setDelta2] = useState('')

  const [cupelEdit, setCupelEdit] = useState(false)
  const [rows, setRows] = useState<ViewRow[]>(() => controlRows('Cornet'))

  const avgDelta = useMemo(() => {
    const vals = [delta1, delta2].filter(Boolean).map(Number)
    if (vals.length === 0) return ''
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)
  }, [delta1, delta2])

  const sheetOptions = useMemo(() => {
    return [...new Set(data.fireAssays.map((a) => a.assayNo).filter(Boolean))]
  }, [data.fireAssays])

  const loadSheet = (
    opts: { mode?: 'CG' | 'Cornet'; sheetNo?: string; silent?: boolean } = {},
  ) => {
    const activeMode = opts.mode ?? mode
    const activeSheet = opts.sheetNo ?? sheetNo

    const matched = data.fireAssays.filter((a) => {
      const typeOk =
        activeMode === 'CG'
          ? a.assayType === 'Cg Auto'
          : a.assayType === 'Cornet Auto' || a.assayType === 'Cornet MS M2'
      const purityOk = !purityFilter || a.declaredPurity === purityFilter
      const dateOk = !date || a.date === date
      const jobOk =
        !jobCard ||
        a.requestNo.toLowerCase().includes(jobCard.toLowerCase()) ||
        a.assayNo.toLowerCase().includes(jobCard.toLowerCase())
      const sheetOk = !activeSheet || a.assayNo === activeSheet
      return typeOk && purityOk && dateOk && jobOk && sheetOk
    })

    const loaded: ViewRow[] = matched.map((a, i) => {
      const sw = a.sampleWeight || 0.25
      const fineness = a.purityFound ? String(a.purityFound) : ''
      const wotg = fineness && sw ? ((Number(fineness) / 1000) * sw).toFixed(4) : ''
      return emptyRow(`fa-${a.id}-${i}`, {
        sampleDrawn: sw.toFixed(3),
        jobCardNo: a.requestNo,
        sampleWeight: sw.toFixed(3),
        silver: '',
        lead: '',
        wotgcaa: wotg,
        fineness,
        meanFineness: fineness,
      })
    })

    setRows([...controlRows(activeMode), ...loaded])
    if (!opts.silent) {
      if (loaded.length === 0) toast('Showing control rows')
      else toast(`Loaded ${loaded.length} row(s)`)
    }
  }

  const setModeAndRows = (next: 'CG' | 'Cornet') => {
    setMode(next)
    loadSheet({ mode: next, silent: true })
  }

  const updateRow = (key: string, patch: Partial<ViewRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        if (r.locked && !cupelEdit) return r
        const next = { ...r, ...patch }
        const sw = Number(next.sampleWeight)
        const w = Number(next.wotgcaa)
        if (!r.locked && sw > 0 && w > 0) {
          next.fineness = ((w / sw) * 1000).toFixed(2)
          next.meanFineness = next.fineness
        }
        return next
      }),
    )
  }

  const exportExcel = () => {
    const header = [
      'SAMPLE DRAWN / BUTTON WT',
      'JOB CARD NO',
      'SAMPLE WEIGHT',
      'SILVER',
      'LEAD',
      'WT. OF GOLD CORNET AFTER ASSAY',
      'FINENESS',
      'MEAN FINENESS',
    ]
    const lines = rows.map((r) =>
      [
        r.sampleDrawn,
        r.jobCardNo,
        r.sampleWeight,
        r.silver,
        r.lead,
        r.wotgcaa,
        r.fineness,
        r.meanFineness,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fire-assay-${mode.toLowerCase()}-${date || 'sheet'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exported to Excel (CSV)')
  }

  const saveAll = () => {
    let updated = 0
    for (const r of rows) {
      if (r.locked || !r.jobCardNo) continue
      // jobCardNo on view sheet = request no (loaded from fireAssays)
      const n = store.updateFireAssayByRequestNo(r.jobCardNo, {
        sampleWeight: Number(r.sampleWeight) || undefined,
        purityFound: Number(r.fineness) || undefined,
        status: 'Completed',
      })
      updated += n
      if (n > 0) {
        const req = data.requests.find((x) => x.requestNo === r.jobCardNo)
        if (req && req.status !== 'Billed' && req.status !== 'Delivered') {
          store.updateRequestStatus(req.id, 'Assayed')
        }
      }
    }
    tenantSet(
      'shrija-view-fire-assay-draft',
      JSON.stringify({
        mode,
        jobCard,
        purityFilter,
        date,
        shift,
        sheetNo,
        purity,
        delta1,
        delta2,
        rows,
      }),
    )
    toast(updated ? `Saved ${updated} assay row(s) to store` : 'Draft saved (no assay rows matched)')
  }

  return (
    <div className="view-assay-page">
      <div className="panel view-assay-filters">
        <div className="view-assay-filter-row">
          <input
            className="view-assay-job"
            placeholder="Enter job card number"
            value={jobCard}
            onChange={(e) => setJobCard(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadSheet()}
          />
          <select value={purityFilter} onChange={(e) => setPurityFilter(e.target.value)}>
            <option value="">Select Purities</option>
            {['999', '916', '750', '585', '925'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="">Select Shift</option>
            <option value="Day">Day</option>
            <option value="Night">Night</option>
          </select>
          <select
            value={sheetNo}
            onChange={(e) => {
              const next = e.target.value
              setSheetNo(next)
              loadSheet({ sheetNo: next })
            }}
          >
            <option value="">Select Sheet No</option>
            {sheetOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="cg-cornet-toggle" role="group" aria-label="Assay mode">
            <button
              type="button"
              className={mode === 'CG' ? 'active' : ''}
              onClick={() => setModeAndRows('CG')}
            >
              CG
            </button>
            <button
              type="button"
              className={mode === 'Cornet' ? 'active' : ''}
              onClick={() => setModeAndRows('Cornet')}
            >
              Cornet
            </button>
          </div>
        </div>

        <div className="view-assay-metric-row">
          <div className="field">
            <label>Purity</label>
            <input value={purity} onChange={(e) => setPurity(e.target.value)} />
          </div>
          <div className="field">
            <label>Delta in Mg 1</label>
            <input value={delta1} onChange={(e) => setDelta1(e.target.value)} />
          </div>
          <div className="field">
            <label>Delta in Mg 2</label>
            <input value={delta2} onChange={(e) => setDelta2(e.target.value)} />
          </div>
          <div className="field">
            <label>Average Delta In Mg</label>
            <input value={avgDelta} readOnly className="table-input-disabled" />
          </div>
        </div>

        <div className="view-assay-actions">
          <div className="view-assay-actions-left">
            <button type="button" className="btn btn-navy" onClick={exportExcel}>
              Export to Excel
            </button>
            <button type="button" className="btn btn-navy" onClick={saveAll}>
              Save All
            </button>
            <button type="button" className="btn btn-navy" onClick={() => window.print()}>
              Print
            </button>
          </div>
          <button
            type="button"
            className={`btn btn-navy ${cupelEdit ? 'btn-cupel-active' : ''}`}
            onClick={() => {
              setCupelEdit((v) => !v)
              toast(cupelEdit ? 'Cupel edit locked' : 'Cupel edit enabled')
            }}
          >
            Edit Cupel
          </button>
        </div>
      </div>

      <div className="panel pending-table-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="data-table navy-head-table cg-sheet-table view-assay-table">
            <thead>
              <tr>
                <th>SAMPLE DRAWN / BUTTON WT</th>
                <th>JOB CARD NO</th>
                <th>SAMPLE WEIGHT</th>
                <th>SILVER</th>
                <th>LEAD</th>
                <th>WT. OF GOLD CORNET AFTER ASSAY</th>
                <th>FINENESS</th>
                <th>MEAN FINENESS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={row.locked ? 'view-assay-control-row' : ''}>
                  <td>
                    <input
                      className="table-input"
                      value={row.sampleDrawn}
                      disabled={Boolean(row.locked && !cupelEdit)}
                      onChange={(e) => updateRow(row.key, { sampleDrawn: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={row.jobCardNo}
                      disabled={Boolean(row.locked && !cupelEdit)}
                      onChange={(e) => updateRow(row.key, { jobCardNo: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={row.sampleWeight}
                      disabled={Boolean(row.locked && !cupelEdit)}
                      onChange={(e) => updateRow(row.key, { sampleWeight: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={row.silver}
                      disabled={Boolean(row.locked && !cupelEdit)}
                      onChange={(e) => updateRow(row.key, { silver: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={row.lead}
                      disabled={Boolean(row.locked && !cupelEdit)}
                      onChange={(e) => updateRow(row.key, { lead: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={row.wotgcaa}
                      disabled={Boolean(row.locked && !cupelEdit)}
                      onChange={(e) => updateRow(row.key, { wotgcaa: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={row.fineness}
                      disabled={Boolean(row.locked && !cupelEdit)}
                      onChange={(e) => updateRow(row.key, { fineness: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={row.meanFineness}
                      disabled={Boolean(row.locked && !cupelEdit)}
                      onChange={(e) => updateRow(row.key, { meanFineness: e.target.value })}
                    />
                  </td>
                  <td>
                    {!row.locked && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="manual-actions">
        <Link to="/create-fire-assay" className="btn btn-navy">
          Back
        </Link>
      </div>
      {Toast}
    </div>
  )
}
