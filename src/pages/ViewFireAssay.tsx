import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import { tenantSet } from '../data/tenant'
import {
  fireAssaySheetDate,
  fireAssaySheetSelectOptions,
  getFireAssaySheet,
  listFireAssaySheetNos,
  loadFireAssaySheetArchive,
  nextSheetNoAfter,
  publishManakFireAssaySheet,
  type ManakFireAssaySheet,
} from '../data/manakFireAssayBridge'
import { FireAssayReportSheet } from '../components/FireAssayReportSheet'
import { getSession } from '../data/auth'
import { USER_NAME } from '../data/modules'
import {
  arrangeFireAssayPresentation,
  finenessFromMasses,
  formatFinenessCell,
  getPrintableFireAssayRows,
  manakJobCardOf,
  mapCgToViewFields,
  mapViewRowsToManakRows,
  pairMeanFineness,
} from '../data/fireAssayViewLayout'
import { applyFireAssayPaperForPrint, printFireAssaySheet } from '../utils/fireAssayPaper'

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

/** Sheets store "1_127506513"; the Manak/day-sheet key is the job card alone. */
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

function controlRowsFromSheet(sheet: ManakFireAssaySheet | null, _mode: 'CG' | 'Cornet'): ViewRow[] {
  const a = mapCgToViewFields(sheet?.cg, 1)
  const b = mapCgToViewFields(sheet?.cg, 2)
  return [
    emptyRow('cg1', {
      locked: true,
      jobCardNo: 'CG1',
      sampleDrawn: a.sampleDrawn,
      sampleWeight: a.sampleWeight,
      silver: a.silver,
      lead: a.lead,
      wotgcaa: a.wotgcaa,
      fineness: a.fineness,
      meanFineness: a.meanFineness,
    }),
    emptyRow('cg2', {
      locked: true,
      jobCardNo: 'CG2',
      sampleDrawn: b.sampleDrawn,
      sampleWeight: b.sampleWeight,
      silver: b.silver,
      lead: b.lead,
      wotgcaa: b.wotgcaa,
      fineness: b.fineness,
      meanFineness: b.meanFineness,
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
      fineness: formatFinenessCell(r.fineness),
      meanFineness: formatFinenessCell(r.meanFineness),
      lotNo: r.lotNo,
    }),
  )
  for (let i = 0; i + 1 < dataRows.length; i += 2) {
    const mean = pairMeanFineness(dataRows[i].fineness, dataRows[i + 1].fineness)
    dataRows[i].meanFineness = mean.first
    dataRows[i + 1].meanFineness = mean.second
  }
  return arrangeFireAssayPresentation([...controlRowsFromSheet(sheet, mode), ...dataRows])
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

  /** Print/PDF only. The on-screen grid keeps the full source sheet (up to 22 slots). */
  const printableRows = useMemo(() => getPrintableFireAssayRows(rows), [rows])
  /** On-screen grid only. Same Job Card filter; does not replace or mutate `rows`. */
  const visibleRows = useMemo(() => getPrintableFireAssayRows(rows), [rows])
  const signedBy = getSession()?.username || USER_NAME

  useEffect(() => {
    const onBeforePrint = () => applyFireAssayPaperForPrint()
    const onAfterPrint = () => document.documentElement.removeAttribute('data-fire-assay-print')
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
      document.documentElement.removeAttribute('data-fire-assay-print')
    }
  }, [])

  /** Live proof correction: sample fineness tracks current avgDelta without regenerating WOTGCAA. */
  useEffect(() => {
    const avg = Number(avgDelta) || 0
    setRows((prev) => {
      if (!prev.length) return prev
      const next = prev.map((r) => {
        if (r.locked) return r
        return {
          ...r,
          fineness: finenessFromMasses(r.sampleWeight, r.wotgcaa, avg),
        }
      })
      const data = next.filter((r) => !r.locked)
      for (let i = 0; i + 1 < data.length; i += 2) {
        const mean = pairMeanFineness(data[i].fineness, data[i + 1].fineness)
        data[i].meanFineness = mean.first
        data[i + 1].meanFineness = mean.second
      }
      return [...next]
    })
  }, [avgDelta])

  const sheetOptions = useMemo(() => {
    void tick
    const fromArchive = listFireAssaySheetNos(
      purityFilter || undefined,
      shift || undefined,
      date,
    )
    const fromStore = data.fireAssays
      .filter((a) => !date || a.date === date)
      .map((a) => a.assayNo.replace(/^FS-/, ''))
      .filter(Boolean)
    const saved = [...new Set([...fromArchive, ...fromStore])]
    return fireAssaySheetSelectOptions(saved, nextSheetNoAfter(saved)).map((o) => o.value)
  }, [tick, purityFilter, shift, date, data.fireAssays])

  const applySheet = (sheet: ManakFireAssaySheet, silent?: boolean) => {
    setLoadedSheet(sheet)
    setPurity(sheet.purity || purityFilter)
    setDelta1(sheet.cg.delta1 != null ? String(sheet.cg.delta1) : '')
    setDelta2(sheet.cg.delta2 != null ? String(sheet.cg.delta2) : '')
    let view = sheetToViewRows(sheet, mode)
    if (jobCard.trim()) {
      const q = jobCard.trim().toLowerCase()
      view = arrangeFireAssayPresentation([
        ...view.filter((r) => r.locked),
        ...view.filter((r) => !r.locked && r.jobCardNo.toLowerCase().includes(q)),
      ])
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
    const sheet = getFireAssaySheet(p, s || 'Day', sn, date)
    if (sheet) {
      applySheet(sheet, opts?.silent)
      return
    }
    // Fallback: archive sheet matching purity + date (do not open another day's sheet)
    const archive = loadFireAssaySheetArchive()
    const match = Object.values(archive).find(
      (x) =>
        x.purity === p &&
        x.sheetNo === sn &&
        (!s || x.shift === s) &&
        fireAssaySheetDate(x) === date,
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

  const onDateChange = (v: string) => {
    setDate(v)
    setSheetNo('')
    setLoadedSheet(null)
    setRows(controlRowsFromSheet(null, mode))
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
        if (!r.locked && (patch.sampleWeight != null || patch.wotgcaa != null)) {
          updated.fineness = finenessFromMasses(
            updated.sampleWeight,
            updated.wotgcaa,
            Number(avgDelta) || 0,
          )
        }
        return updated
      })
      // Mean fineness on pair rows (skip locked CG rows)
      const data = next.filter((r) => !r.locked)
      for (let i = 0; i + 1 < data.length; i += 2) {
        const a = data[i]
        const b = data[i + 1]
        const mean = pairMeanFineness(a.fineness, b.fineness)
        a.meanFineness = mean.first
        b.meanFineness = mean.second
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
    const sheetRows = loadedSheet?.viewRows?.length ? loadedSheet.viewRows : loadedSheet?.rows || []
    const viewRows = mapViewRowsToManakRows(dataRows, sheetRows)
    const byJobCard = new Map(
      sheetRows.filter((r) => r.jobCardNo).map((r) => [manakJobCardOf(r.jobCardNo), r]),
    )
    const base: ManakFireAssaySheet = loadedSheet || {
      version: 1,
      source: 'shrija-hallmark-suite',
      createdAt: new Date().toISOString(),
      date,
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
      date: base.date || date,
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
    publishManakFireAssaySheet(next)
    // Assay finished here → carry each job card's cornet (WOTGCAA, mg) onto its
    // day-sheet row, so QM Request List and Billing read it without re-entry
    store.applyFireAssayCornet(
      next.rows.map((r) => ({
        jobCardNo: r.manakJobCard || r.jobCardNo,
        requestNo: r.requestNo,
        cornet: r.wotgcaa,
      })),
    )
    store.applyFireAssaySampleWeights(
      rows
        .filter((r) => !r.locked && r.jobCardNo.trim())
        .map((r) => ({
          jobCardNo: manakJobCardOf(r.jobCardNo),
          requestNo: byJobCard.get(manakJobCardOf(r.jobCardNo))?.requestNo,
          sampleWeight: r.sampleWeight.trim() === '' ? null : Number(r.sampleWeight),
          sampleDrawn: r.sampleDrawn.trim() === '' ? null : Number(r.sampleDrawn),
        })),
    )
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
      <div className="view-assay-work no-print">
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
          <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
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
            <button type="button" className="btn btn-navy" onClick={() => printFireAssaySheet()}>
              Print / PDF
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
              {visibleRows.map((row) => (
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
      </div>

      <div className="fa-report-print-root" aria-hidden="true">
        <FireAssayReportSheet
          rows={printableRows}
          purity={purity}
          delta1={delta1}
          delta2={delta2}
          avgDelta={avgDelta}
          weighingDate={date}
          reportingDate={date}
          weightedBy={signedBy}
          reportedBy={signedBy}
        />
      </div>
      {Toast}
    </div>
  )
}
