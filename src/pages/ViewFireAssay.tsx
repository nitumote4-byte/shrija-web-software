import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import { tenantSet } from '../data/tenant'
import {
  getFireAssaySheet,
  listFireAssaySheetNos,
  loadFireAssaySheetArchive,
  saveFireAssaySheetArchive,
  type ManakFireAssaySheet,
} from '../data/manakFireAssayBridge'

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
  lotNo?: number
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

function controlRowsFromSheet(sheet: ManakFireAssaySheet | null, mode: 'CG' | 'Cornet'): ViewRow[] {
  const cg = sheet?.cg
  const copperLabel1 = mode === 'Cornet' ? 'Copper 1' : 'CG Ref 1'
  const copperLabel2 = mode === 'Cornet' ? 'Copper 2' : 'CG Ref 2'
  return [
    emptyRow('cg1', {
      locked: true,
      jobCardNo: 'CG1',
      sampleDrawn: cg?.cg1 ? String(cg.cg1) : '',
      sampleWeight: cg?.wotgcaa1 ? String(cg.wotgcaa1) : '',
      silver: cg?.silverCg1 ? String(cg.silverCg1) : '',
      lead: cg?.leadCg1 != null ? String(cg.leadCg1) : '',
      wotgcaa: cg?.copperCg1 ? String(cg.copperCg1) : '',
      fineness: copperLabel1,
      meanFineness: cg?.delta1 != null ? String(cg.delta1) : '',
    }),
    emptyRow('cg2', {
      locked: true,
      jobCardNo: 'CG2',
      sampleDrawn: cg?.cg2 ? String(cg.cg2) : '',
      sampleWeight: cg?.wotgcaa2 ? String(cg.wotgcaa2) : '',
      silver: cg?.silverCg2 ? String(cg.silverCg2) : '',
      lead: cg?.leadCg2 != null ? String(cg.leadCg2) : '',
      wotgcaa: cg?.copperCg2 ? String(cg.copperCg2) : '',
      fineness: copperLabel2,
      meanFineness: cg?.delta2 != null ? String(cg.delta2) : '',
    }),
  ]
}

function sheetToViewRows(sheet: ManakFireAssaySheet, mode: 'CG' | 'Cornet'): ViewRow[] {
  const source = sheet.viewRows?.length ? sheet.viewRows : sheet.rows
  const dataRows = source.map((r, i) =>
    emptyRow(`vr-${sheet.sheetNo}-${i}`, {
      sampleDrawn: r.sampleDrawn ? r.sampleDrawn.toFixed(3) : '',
      jobCardNo: r.jobCardNo || '',
      sampleWeight: r.sampleWeight ? r.sampleWeight.toFixed(3) : '',
      silver: r.silver ? String(r.silver) : '',
      lead: r.lead ? String(r.lead) : '',
      wotgcaa: r.wotgcaa ? r.wotgcaa.toFixed(3) : '',
      fineness: r.fineness ? String(r.fineness) : '',
      meanFineness: r.meanFineness != null ? String(r.meanFineness) : '',
      lotNo: r.lotNo,
    }),
  )
  return [...controlRowsFromSheet(sheet, mode), ...dataRows]
}

export function ViewFireAssay() {
  const data = store.getAllRaw()
  const { toast, Toast } = useToast()
  const [tick, setTick] = useState(0)

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
  const [rows, setRows] = useState<ViewRow[]>(() => controlRowsFromSheet(null, 'Cornet'))
  const [loadedSheet, setLoadedSheet] = useState<ManakFireAssaySheet | null>(null)

  const avgDelta = useMemo(() => {
    const vals = [delta1, delta2].filter(Boolean).map(Number)
    if (vals.length === 0) return ''
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)
  }, [delta1, delta2])

  const sheetOptions = useMemo(() => {
    void tick
    const fromArchive = listFireAssaySheetNos(
      purityFilter || undefined,
      shift || undefined,
    )
    const fromStore = data.fireAssays
      .map((a) => a.assayNo.replace(/^FS-/, ''))
      .filter(Boolean)
    return [...new Set([...fromArchive, ...fromStore, '1', '2', '3', '4', '5'])].sort(
      (a, b) => Number(a) - Number(b) || a.localeCompare(b),
    )
  }, [tick, purityFilter, shift, data.fireAssays])

  const applySheet = (sheet: ManakFireAssaySheet, silent?: boolean) => {
    setLoadedSheet(sheet)
    setPurity(sheet.purity || purityFilter)
    setDelta1(sheet.cg.delta1 != null ? String(sheet.cg.delta1) : '')
    setDelta2(sheet.cg.delta2 != null ? String(sheet.cg.delta2) : '')
    let view = sheetToViewRows(sheet, mode)
    if (jobCard.trim()) {
      const q = jobCard.trim().toLowerCase()
      view = [
        ...view.filter((r) => r.locked),
        ...view.filter(
          (r) => !r.locked && r.jobCardNo.toLowerCase().includes(q),
        ),
      ]
    }
    setRows(view)
    if (!silent) {
      const n = (sheet.viewRows || sheet.rows).length
      toast(`Opened sheet ${sheet.sheetNo} · ${n} row(s) · ${sheet.purity} · ${sheet.shift}`)
    }
  }

  /** Gold Shark: select Purity + Shift + Sheet → open saved Create Sheet */
  const openSavedSheet = (opts?: {
    purity?: string
    shift?: string
    sheetNo?: string
    silent?: boolean
  }) => {
    const p = opts?.purity ?? purityFilter
    const s = opts?.shift ?? shift
    const sn = opts?.sheetNo ?? sheetNo
    if (!p || !sn) {
      setRows(controlRowsFromSheet(null, mode))
      setLoadedSheet(null)
      if (!opts?.silent && (!p || !sn)) {
        /* wait until all three selected */
      }
      return
    }
    const sheet = getFireAssaySheet(p, s || 'Day', sn)
    if (sheet) {
      applySheet(sheet, opts?.silent)
      return
    }
    // Fallback: latest archive sheet matching purity
    const archive = loadFireAssaySheetArchive()
    const match = Object.values(archive).find(
      (x) => x.purity === p && x.sheetNo === sn && (!s || x.shift === s),
    )
    if (match) {
      applySheet(match, opts?.silent)
      return
    }
    setLoadedSheet(null)
    setPurity(p)
    setRows(controlRowsFromSheet(null, mode))
    if (!opts?.silent) toast('No saved sheet for this Purity / Shift / Sheet — Create Sheet first')
  }

  const onPurityChange = (v: string) => {
    setPurityFilter(v)
    setPurity(v)
    if (v && shift && sheetNo) openSavedSheet({ purity: v, shift, sheetNo })
    else if (!v) {
      setRows(controlRowsFromSheet(null, mode))
      setLoadedSheet(null)
    }
  }

  const onShiftChange = (v: string) => {
    setShift(v)
    if (purityFilter && v && sheetNo) openSavedSheet({ purity: purityFilter, shift: v, sheetNo })
  }

  const onSheetChange = (v: string) => {
    setSheetNo(v)
    if (purityFilter && shift && v) openSavedSheet({ purity: purityFilter, shift, sheetNo: v })
    else if (purityFilter && v) openSavedSheet({ purity: purityFilter, shift: shift || 'Day', sheetNo: v })
  }

  const setModeAndRows = (next: 'CG' | 'Cornet') => {
    setMode(next)
    if (loadedSheet) applySheet(loadedSheet, true)
    else setRows(controlRowsFromSheet(null, next))
  }

  const updateRow = (key: string, patch: Partial<ViewRow>) => {
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.key !== key) return r
        if (r.locked && !cupelEdit) return r
        const updated = { ...r, ...patch }
        const sw = Number(updated.sampleWeight)
        const w = Number(updated.wotgcaa)
        if (!r.locked && sw > 0 && w > 0 && (patch.sampleWeight != null || patch.wotgcaa != null)) {
          updated.fineness = ((w / sw) * 1000).toFixed(3)
        }
        return updated
      })
      // Mean fineness on pair rows (skip locked CG rows)
      const data = next.filter((r) => !r.locked)
      for (let i = 0; i + 1 < data.length; i += 2) {
        const a = data[i]
        const b = data[i + 1]
        a.meanFineness = '0.0'
        b.meanFineness = (
          (Number(a.fineness || 0) + Number(b.fineness || 0)) /
          2
        ).toFixed(3)
        if (patch.jobCardNo != null && (key === a.key || key === b.key)) {
          a.jobCardNo = patch.jobCardNo
          b.jobCardNo = patch.jobCardNo
        }
      }
      return [...next]
    })
  }

  const saveRow = (key: string) => {
    const r = rows.find((x) => x.key === key)
    if (!r || r.locked) return
    if (r.jobCardNo) {
      store.updateFireAssayByRequestNo(r.jobCardNo, {
        sampleWeight: Number(r.sampleWeight) || undefined,
        purityFound: Number(r.fineness) || undefined,
        status: 'Completed',
      })
    }
    persistViewToArchive()
    toast(`Saved ${r.jobCardNo || 'row'}`)
  }

  const persistViewToArchive = () => {
    if (!loadedSheet && !(purityFilter && sheetNo)) return
    const dataRows = rows.filter((r) => !r.locked)
    const viewRows = dataRows.map((r, i) => ({
      lotNo: r.lotNo || Math.floor(i / 2) + 1,
      jobCardNo: r.jobCardNo,
      manakJobCard: r.jobCardNo.replace(/^\d+[_\-/]/, '').trim(),
      sampleDrawn: Number(r.sampleDrawn) || 0,
      sampleWeight: Number(r.sampleWeight) || 0,
      silver: Number(r.silver) || 0,
      copper: 0,
      lead: Number(r.lead) || 4,
      wotgcaa: Number(r.wotgcaa) || 0,
      fineness: Number(r.fineness) || 0,
      meanFineness: Number(r.meanFineness) || 0,
    }))
    const base: ManakFireAssaySheet = loadedSheet || {
      version: 1,
      source: 'shrija-hallmark-suite',
      createdAt: new Date().toISOString(),
      purity: purityFilter || purity || '916',
      shift: shift || 'Day',
      sheetNo: sheetNo || '1',
      assayType: mode === 'CG' ? 'Cg Auto' : 'Cornet Auto',
      cg: {
        cg1: 0,
        cg2: 0,
        silverCg1: 0,
        silverCg2: 0,
        copperCg1: 0,
        copperCg2: 0,
        leadCg1: 4,
        leadCg2: 4,
        wotgcaa1: 0,
        wotgcaa2: 0,
        delta1: Number(delta1) || 0,
        delta2: Number(delta2) || 0,
        avgDelta: Number(avgDelta) || 0,
      },
      rows: [],
    }
    const next: ManakFireAssaySheet = {
      ...base,
      purity: purityFilter || base.purity,
      shift: shift || base.shift,
      sheetNo: sheetNo || base.sheetNo,
      cg: {
        ...base.cg,
        delta1: Number(delta1) || base.cg.delta1,
        delta2: Number(delta2) || base.cg.delta2,
        avgDelta: Number(avgDelta) || base.cg.avgDelta,
      },
      viewRows,
      rows: viewRows.filter((r) => r.jobCardNo.trim()),
    }
    saveFireAssaySheetArchive(next)
    setLoadedSheet(next)
    setTick((t) => t + 1)
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
    a.download = `fire-assay-${mode.toLowerCase()}-sheet${sheetNo || ''}-${date || 'sheet'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exported to Excel (CSV)')
  }

  const saveAll = () => {
    let updated = 0
    for (const r of rows) {
      if (r.locked || !r.jobCardNo) continue
      const n = store.updateFireAssayByRequestNo(r.jobCardNo, {
        sampleWeight: Number(r.sampleWeight) || undefined,
        purityFound: Number(r.fineness) || undefined,
        status: 'Completed',
      })
      updated += n
    }
    persistViewToArchive()
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
    toast(updated ? `Saved ${updated} assay row(s)` : 'Sheet saved')
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && loadedSheet) applySheet(loadedSheet)
            }}
          />
          <select value={purityFilter} onChange={(e) => onPurityChange(e.target.value)}>
            <option value="">Select Purities</option>
            {['999', '916', '750', '585', '925'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={shift} onChange={(e) => onShiftChange(e.target.value)}>
            <option value="">Select Shift</option>
            <option value="Day">Day</option>
            <option value="Night">Night</option>
          </select>
          <select value={sheetNo} onChange={(e) => onSheetChange(e.target.value)}>
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

        <p className="cg-flow-hint" style={{ marginTop: '0.75rem' }}>
          Select <strong>Purity</strong>, <strong>Shift</strong> and <strong>Sheet</strong> to open
          the saved Create Sheet (Gold Shark View Fire Assay).
        </p>

        <div className="view-assay-metric-row">
          <div className="field">
            <label>Purity</label>
            <input value={purity} onChange={(e) => setPurity(e.target.value)} />
          </div>
          <div className="field">
            <label>Delta In Mg 1</label>
            <input value={delta1} onChange={(e) => setDelta1(e.target.value)} />
          </div>
          <div className="field">
            <label>Delta In Mg 2</label>
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
                      placeholder={row.locked ? '' : 'Enter Job Card No'}
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
                        className="btn btn-green view-assay-save-btn"
                        onClick={() => saveRow(row.key)}
                      >
                        Save
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
