import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui'
import { store } from '../data/store'

type SheetRow = {
  key: string
  sampleDrawn: string
  jobCardNo: string
  sampleWeight: string
  silver: string
  lead: string
  wotgcaa: string
  fineness: string
  meanFineness: string
  partyName: string
  requestNo: string
}

type Mode = 'cg-auto' | 'cornet-auto' | 'cornet-ms-m2' | 'manual'

const MODE_META: Record<
  Mode,
  { tab: string; assayType: 'Cg Auto' | 'Cornet Auto' | 'Cornet MS M2' | 'Manual' }
> = {
  'cg-auto': { tab: 'Cg Auto Fire Assay', assayType: 'Cg Auto' },
  'cornet-auto': { tab: 'Cornet Fire Assay', assayType: 'Cornet Auto' },
  'cornet-ms-m2': { tab: 'Cornet Fire Assay MS M2', assayType: 'Cornet MS M2' },
  manual: { tab: 'Manual Fire Assay', assayType: 'Manual' },
}

function FireAssaySheet({ mode }: { mode: Mode }) {
  const data = store.getAll()
  const navigate = useNavigate()
  const { toast, Toast } = useToast()
  const meta = MODE_META[mode]

  const [purity, setPurity] = useState('916')
  const [shift, setShift] = useState('Day')
  const [sheetNo, setSheetNo] = useState(`FS-${Date.now().toString().slice(-6)}`)
  const [noOfRows, setNoOfRows] = useState('22')

  const [silverCg1, setSilverCg1] = useState('')
  const [silverCg2, setSilverCg2] = useState('')
  const [leadCg1, setLeadCg1] = useState('')
  const [leadCg2, setLeadCg2] = useState('')
  const [wotgcaa1, setWotgcaa1] = useState('')
  const [wotgcaa2, setWotgcaa2] = useState('')
  const [copperCg1, setCopperCg1] = useState('')
  const [copperCg2, setCopperCg2] = useState('')
  const [cg1, setCg1] = useState('')
  const [cg2, setCg2] = useState('')

  const [jobQuery, setJobQuery] = useState('')
  const [jobOpen, setJobOpen] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [rows, setRows] = useState<SheetRow[]>([])
  const excelInputRef = useRef<HTMLInputElement>(null)

  const isCornet = mode === 'cornet-auto' || mode === 'cornet-ms-m2'
  const isManual = mode === 'manual'

  // Cornet: CG1/CG2 are measured WOTGCAA text; WOTGCAA1/2 dropdowns are reference CG
  const delta1 = useMemo(() => {
    if (isCornet) {
      if (!cg1 || !wotgcaa1) return ''
      return ((Number(cg1) - Number(wotgcaa1)) * 1000).toFixed(3)
    }
    if (!wotgcaa1 || !cg1) return ''
    return ((Number(wotgcaa1) - Number(cg1)) * 1000).toFixed(3)
  }, [isCornet, wotgcaa1, cg1])

  const delta2 = useMemo(() => {
    if (isCornet) {
      if (!cg2 || !wotgcaa2) return ''
      return ((Number(cg2) - Number(wotgcaa2)) * 1000).toFixed(3)
    }
    if (!wotgcaa2 || !cg2) return ''
    return ((Number(wotgcaa2) - Number(cg2)) * 1000).toFixed(3)
  }, [isCornet, wotgcaa2, cg2])

  const avgDelta = useMemo(() => {
    if (!delta1 && !delta2) return ''
    const vals = [delta1, delta2].filter(Boolean).map(Number)
    if (vals.length === 0) return ''
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)
  }, [delta1, delta2])

  const jobOptions = useMemo(() => {
    const q = jobQuery.trim().toLowerCase()
    return data.requests.filter((r) => {
      if (selectedJobs.includes(r.id)) return false
      if (!q) return true
      return (
        r.requestNo.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q)
      )
    })
  }, [data.requests, jobQuery, selectedJobs])

  const toggleJob = (id: string) => {
    setSelectedJobs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const createSheet = () => {
    if (selectedJobs.length === 0) {
      toast('Search and select at least one job')
      return
    }
    const maxRows = Math.min(Number(noOfRows) || 22, selectedJobs.length)
    const picked = selectedJobs.slice(0, maxRows)
    const avg = Number(avgDelta) || 0

    const nextRows: SheetRow[] = picked.map((id, i) => {
      const req = data.requests.find((r) => r.id === id)!
      const sampleWt = 0.25
      const silver = Number(silverCg1) || Number(silverCg2) || 2.5
      const lead = Number(leadCg1) || Number(leadCg2) || 30
      const baseCornet = sampleWt * (Number(req.purity) / 1000)
      const wotg = Number((baseCornet + avg / 1000 + (Math.random() - 0.5) * 0.002).toFixed(4))
      const fineness = Number(((wotg / sampleWt) * 1000).toFixed(2))
      return {
        key: `row-${Date.now()}-${i}`,
        sampleDrawn: sampleWt.toFixed(3),
        jobCardNo: `JC-${req.requestNo.slice(-4)}`,
        sampleWeight: sampleWt.toFixed(3),
        silver: silver.toFixed(3),
        lead: lead.toFixed(3),
        wotgcaa: wotg.toFixed(4),
        fineness: fineness.toFixed(2),
        meanFineness: fineness.toFixed(2),
        partyName: req.partyName,
        requestNo: req.requestNo,
      }
    })

    setRows(nextRows)

    // Persist each as fire assay record
    for (const row of nextRows) {
      const req = data.requests.find((r) => r.requestNo === row.requestNo)
      if (!req) continue
      store.addFireAssay({
        requestNo: req.requestNo,
        partyName: req.partyName,
        sampleWeight: Number(row.sampleWeight),
        purityFound: Number(row.fineness),
        declaredPurity: req.purity,
        status: 'Completed',
        analyst: 'Auto Lab',
        assayType: meta.assayType,
      })
      store.updateRequestStatus(req.id, 'Assayed')
    }

    toast(`Sheet ${sheetNo} created · ${nextRows.length} row(s)`)
  }

  const updateRow = (key: string, patch: Partial<SheetRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const next = { ...r, ...patch }
        const sw = Number(next.sampleWeight)
        const w = Number(next.wotgcaa)
        if (sw > 0 && w > 0) {
          next.fineness = ((w / sw) * 1000).toFixed(2)
          next.meanFineness = next.fineness
        }
        return next
      }),
    )
  }

  const downloadTemplate = () => {
    const header = [
      'Sample Drawn / Button Weight',
      'Job Card No',
      'Sample Weight',
      'Silver',
      'Lead',
      'Weight Of The Gold Cornet After Assaying',
      'Fineness In PPT',
      'Mean Fineness In PPT',
    ]
    const sample = ['0.250', 'JC-1001', '0.250', '2.500', '30.000', '0.2290', '', '']
    const csv = [header.join(','), sample.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'manual-fire-assay-template.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast('Template downloaded')
  }

  const parseCsvLine = (line: string) => {
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur.trim())
        cur = ''
        continue
      }
      cur += ch
    }
    cells.push(cur.trim())
    return cells
  }

  const handleExcelUpload = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length < 2) {
        toast('File has no data rows')
        return
      }
      const dataLines = lines.slice(1)
      const maxRows = Math.min(Number(noOfRows) || 22, dataLines.length)
      const nextRows: SheetRow[] = dataLines.slice(0, maxRows).map((line, i) => {
        const c = parseCsvLine(line)
        const sampleWeight = c[2] || c[0] || '0.250'
        const wotgcaa = c[5] || ''
        const sw = Number(sampleWeight)
        const w = Number(wotgcaa)
        const fineness =
          c[6] || (sw > 0 && w > 0 ? ((w / sw) * 1000).toFixed(2) : '')
        return {
          key: `upload-${Date.now()}-${i}`,
          sampleDrawn: c[0] || sampleWeight,
          jobCardNo: c[1] || `JC-${1000 + i}`,
          sampleWeight,
          silver: c[3] || '',
          lead: c[4] || '',
          wotgcaa,
          fineness,
          meanFineness: c[7] || fineness,
          partyName: '',
          requestNo: '',
        }
      })
      setRows(nextRows)
      toast(`Uploaded ${nextRows.length} row(s) from Excel/CSV`)
    }
    reader.readAsText(file)
    if (excelInputRef.current) excelInputRef.current.value = ''
  }

  return (
    <div className="cg-assay-page">
      {!isManual && (
        <div className="cg-tabs">
          <button
            type="button"
            className={`cg-tab ${mode === 'cg-auto' ? 'active' : ''}`}
            onClick={() => navigate('/create-fire-assay/cg-auto')}
          >
            Cg Fire Assay
          </button>
          <button type="button" className="cg-tab" onClick={() => navigate('/create-fire-assay/manual')}>
            Manual Fire Assay
          </button>
        </div>
      )}

      <div className="panel cg-form-panel">
        <div className="cg-form-grid">
          <div className="field">
            <label>Select Purity</label>
            <select value={purity} onChange={(e) => setPurity(e.target.value)}>
              {['999', '916', '750', '585', '925'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Select Shift</label>
            <select value={shift} onChange={(e) => setShift(e.target.value)}>
              <option>Day</option>
              <option>Night</option>
            </select>
          </div>
          <div className="field">
            <label>Sheet no</label>
            <select value={sheetNo} onChange={(e) => setSheetNo(e.target.value)}>
              <option value={sheetNo}>{sheetNo}</option>
              <option value="FS-1001">FS-1001</option>
              <option value="FS-1002">FS-1002</option>
              <option value="FS-1003">FS-1003</option>
            </select>
          </div>
          <div className="field">
            <label>No. of Rows</label>
            <input
              type="number"
              min="1"
              max="50"
              value={noOfRows}
              onChange={(e) => setNoOfRows(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Silver CG1</label>
            <input
              placeholder="Silver CG 1"
              value={silverCg1}
              onChange={(e) => setSilverCg1(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Silver CG2</label>
            <input
              placeholder="Silver CG 2"
              value={silverCg2}
              onChange={(e) => setSilverCg2(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{isCornet || isManual ? 'Lead Cg1' : 'Lead CG1'}</label>
            <input
              placeholder="Lead CG 1"
              value={leadCg1}
              onChange={(e) => setLeadCg1(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Lead CG2</label>
            <input
              placeholder="Lead CG 2"
              value={leadCg2}
              onChange={(e) => setLeadCg2(e.target.value)}
            />
          </div>

          {isCornet ? (
            <>
              <div className="field">
                <label>CG1</label>
                <input
                  placeholder="wotgca1"
                  value={cg1}
                  onChange={(e) => setCg1(e.target.value)}
                />
              </div>
              <div className="field">
                <label>CG2</label>
                <input
                  placeholder="wotgca2"
                  value={cg2}
                  onChange={(e) => setCg2(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Copper CG1</label>
                <input
                  placeholder="Copper CG1"
                  value={copperCg1}
                  onChange={(e) => setCopperCg1(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Copper CG2</label>
                <input
                  placeholder="Copper CG2"
                  value={copperCg2}
                  onChange={(e) => setCopperCg2(e.target.value)}
                />
              </div>
              <div className="field">
                <label>WOTGCAA1</label>
                <select value={wotgcaa1} onChange={(e) => setWotgcaa1(e.target.value)}>
                  <option value="">Select CG1</option>
                  <option value="0.229">0.229</option>
                  <option value="0.230">0.230</option>
                  <option value="0.231">0.231</option>
                  <option value="0.232">0.232</option>
                </select>
              </div>
              <div className="field">
                <label>WOTGCAA2</label>
                <select value={wotgcaa2} onChange={(e) => setWotgcaa2(e.target.value)}>
                  <option value="">Select CG2</option>
                  <option value="0.229">0.229</option>
                  <option value="0.230">0.230</option>
                  <option value="0.231">0.231</option>
                  <option value="0.232">0.232</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label>WOTGCAA1</label>
                <input
                  placeholder="wotgca1"
                  value={wotgcaa1}
                  onChange={(e) => setWotgcaa1(e.target.value)}
                />
              </div>
              <div className="field">
                <label>WOTGCAA2</label>
                <input
                  placeholder="wotgca2"
                  value={wotgcaa2}
                  onChange={(e) => setWotgcaa2(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Copper CG1</label>
                <input
                  placeholder={isManual ? 'Copper C' : 'Copper CG 1'}
                  value={copperCg1}
                  onChange={(e) => setCopperCg1(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Copper CG2</label>
                <input
                  placeholder={isManual ? 'Copper C' : 'Copper CG 2'}
                  value={copperCg2}
                  onChange={(e) => setCopperCg2(e.target.value)}
                />
              </div>
              <div className="field">
                <label>CG1</label>
                <select value={cg1} onChange={(e) => setCg1(e.target.value)}>
                  <option value="">Select CG1</option>
                  <option value="0.229">0.229</option>
                  <option value="0.230">0.230</option>
                  <option value="0.231">0.231</option>
                  <option value="0.232">0.232</option>
                </select>
              </div>
              <div className="field">
                <label>CG2</label>
                <select value={cg2} onChange={(e) => setCg2(e.target.value)}>
                  <option value="">Select CG2</option>
                  <option value="0.229">0.229</option>
                  <option value="0.230">0.230</option>
                  <option value="0.231">0.231</option>
                  <option value="0.232">0.232</option>
                </select>
              </div>
            </>
          )}

          <div className="field">
            <label>Delta In Mg 1</label>
            <input placeholder="Delta1" value={delta1} readOnly className="table-input-disabled" />
          </div>
          <div className="field">
            <label>Delta In Mg 2</label>
            <input placeholder="Delta2" value={delta2} readOnly className="table-input-disabled" />
          </div>
          <div className="field">
            <label>Average Delta In Mg</label>
            <input
              placeholder="average-delta"
              value={avgDelta}
              readOnly
              className="table-input-disabled"
            />
          </div>
        </div>

        <div className="field cg-job-field">
          <label>Search and select jobs</label>
          <div className="party-search">
            <textarea
              className="cg-job-search"
              placeholder="Search and select jobs"
              value={jobQuery}
              onChange={(e) => {
                setJobQuery(e.target.value)
                setJobOpen(true)
              }}
              onFocus={() => setJobOpen(true)}
              onBlur={() => setTimeout(() => setJobOpen(false), 150)}
              rows={2}
            />
            {jobOpen && jobOptions.length > 0 && (
              <div className="party-dropdown">
                {jobOptions.slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="party-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      toggleJob(r.id)
                      setJobQuery('')
                      setJobOpen(false)
                    }}
                  >
                    <strong>
                      {r.requestNo} — {r.partyName}
                    </strong>
                    <span>
                      {r.categoryName} · {r.weight}g · {r.purity}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedJobs.length > 0 && (
            <div className="cg-selected-jobs">
              {selectedJobs.map((id) => {
                const req = data.requests.find((r) => r.id === id)
                if (!req) return null
                return (
                  <span key={id} className="cg-job-chip">
                    {req.requestNo} · {req.partyName}
                    <button type="button" onClick={() => toggleJob(id)}>
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          <div className="cg-count">Count : {selectedJobs.length || ''}</div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-navy" onClick={createSheet}>
            Create Sheet
          </button>
          {isManual && (
            <>
              <button type="button" className="btn btn-green" onClick={downloadTemplate}>
                Download Template
              </button>
              <button
                type="button"
                className="btn btn-teal"
                onClick={() => excelInputRef.current?.click()}
              >
                Upload Excel
              </button>
              <input
                ref={excelInputRef}
                type="file"
                accept=".csv,.tsv,.xls,.xlsx,text/csv"
                hidden
                onChange={(e) => handleExcelUpload(e.target.files?.[0] ?? null)}
              />
            </>
          )}
        </div>
      </div>

      <div className="panel pending-table-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="data-table navy-head-table cg-sheet-table">
            <thead>
              <tr>
                <th>Sample Drawn / Button Weight</th>
                <th>Job Card No</th>
                <th>Sample Weight</th>
                <th>Silver</th>
                <th>Lead</th>
                <th>Weight Of The Gold Cornet After Assaying</th>
                <th>Fineness In PPT</th>
                <th>Mean Fineness In PPT</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state" />
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <input
                        className="table-input"
                        value={row.sampleDrawn}
                        onChange={(e) => updateRow(row.key, { sampleDrawn: e.target.value })}
                      />
                    </td>
                    <td>{row.jobCardNo}</td>
                    <td>
                      <input
                        className="table-input"
                        value={row.sampleWeight}
                        onChange={(e) => updateRow(row.key, { sampleWeight: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={row.silver}
                        onChange={(e) => updateRow(row.key, { silver: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={row.lead}
                        onChange={(e) => updateRow(row.key, { lead: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={row.wotgcaa}
                        onChange={(e) => updateRow(row.key, { wotgcaa: e.target.value })}
                      />
                    </td>
                    <td>{row.fineness}</td>
                    <td>{row.meanFineness}</td>
                  </tr>
                ))
              )}
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

export function CgAutoFireAssay() {
  return <FireAssaySheet mode="cg-auto" />
}

export function CornetAutoFireAssay() {
  return <FireAssaySheet mode="cornet-auto" />
}

export function CornetMsM2FireAssay() {
  return <FireAssaySheet mode="cornet-ms-m2" />
}

export function ManualFireAssay() {
  return <FireAssaySheet mode="manual" />
}
