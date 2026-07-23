import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui'
import { store } from '../data/store'
import {
  copperForCg,
  deltaMg,
  expectedWotgcaa,
  finenessPpt,
  getBisDefaults,
  sampleDrawnMgFromRequest,
  splitSampleWeights,
} from '../data/fireAssayBis'
import {
  publishManakFireAssaySheet,
  type ManakFireAssaySheet,
} from '../data/manakFireAssayBridge'
import { loadCgWeights, markCgWeightsUsed, type CgWeightRow } from './CGWeight'

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
  lotNo: number
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

function parseLotJobCard(raw: string): { lotNo: number; jobCard: string } {
  const t = raw.trim()
  const m = /^(\d+)\s*[_\-/]\s*(\d+)$/.exec(t)
  if (m) return { lotNo: Number(m[1]), jobCard: m[2] }
  return { lotNo: 1, jobCard: t }
}

function FireAssaySheet({ mode }: { mode: Mode }) {
  const data = store.getAll()
  const navigate = useNavigate()
  const { toast, Toast } = useToast()
  const meta = MODE_META[mode]
  const excelInputRef = useRef<HTMLInputElement>(null)
  const [cgTick, setCgTick] = useState(0)

  const [purity, setPurity] = useState('')
  const [shift, setShift] = useState('Day')
  const [sheetNo, setSheetNo] = useState('1')
  const [noOfRows, setNoOfRows] = useState('22')

  const [silverCg1, setSilverCg1] = useState('')
  const [silverCg2, setSilverCg2] = useState('')
  const [leadCg1, setLeadCg1] = useState('')
  const [leadCg2, setLeadCg2] = useState('')
  const [wotgcaa1, setWotgcaa1] = useState('')
  const [wotgcaa2, setWotgcaa2] = useState('')
  const [copperCg1, setCopperCg1] = useState('')
  const [copperCg2, setCopperCg2] = useState('')
  const [cg1Id, setCg1Id] = useState('')
  const [cg2Id, setCg2Id] = useState('')

  const [jobQuery, setJobQuery] = useState('')
  const [jobOpen, setJobOpen] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [rows, setRows] = useState<SheetRow[]>([])

  const isCornet = mode === 'cornet-auto' || mode === 'cornet-ms-m2'
  const isManual = mode === 'manual'
  /** CG Auto / Cornet: Gold Shark sheet — no separate job pick; N rows from No. of Rows */
  const isSheetMode = mode === 'cg-auto' || isCornet
  const noJobPick = mode === 'cg-auto' || mode === 'cornet-auto'

  const unusedCg = useMemo(() => {
    void cgTick
    return loadCgWeights()
      .filter((r) => !r.used)
      .filter((r) => !purity || !r.purity || r.purity === purity)
      .sort((a, b) => b.id - a.id)
  }, [cgTick, purity])

  const cg1Row = unusedCg.find((r) => String(r.id) === cg1Id)
  const cg2Row = unusedCg.find((r) => String(r.id) === cg2Id)
  const cg1Val = cg1Row?.weight ?? 0
  const cg2Val = cg2Row?.weight ?? 0

  const delta1 = useMemo(() => {
    const w = Number(wotgcaa1)
    if (!cg1Val || !w) return ''
    return deltaMg(cg1Val, w).toFixed(3)
  }, [cg1Val, wotgcaa1])

  const delta2 = useMemo(() => {
    const w = Number(wotgcaa2)
    if (!cg2Val || !w) return ''
    return deltaMg(cg2Val, w).toFixed(3)
  }, [cg2Val, wotgcaa2])

  const avgDelta = useMemo(() => {
    if (!delta1 && !delta2) return ''
    const vals = [delta1, delta2].filter(Boolean).map(Number)
    if (!vals.length) return ''
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)
  }, [delta1, delta2])

  const jobOptions = useMemo(() => {
    const q = jobQuery.trim().toLowerCase()
    return data.requests.filter((r) => {
      if (selectedJobs.includes(r.id)) return false
      if (r.status === 'Billed' || r.status === 'Delivered') return false
      if (!q) return true
      return (
        r.requestNo.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        (r.jobCardNo || '').toLowerCase().includes(q)
      )
    })
  }, [data.requests, jobQuery, selectedJobs])

  const toggleJob = (id: string) => {
    setSelectedJobs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function autofillRows(
    prev: SheetRow[],
    pur: string,
    avg: number,
    silverStrip: number,
    lead: number,
  ): SheetRow[] {
    const byReq = new Map<string, SheetRow[]>()
    for (const r of prev) {
      const k = r.requestNo || r.key
      const list = byReq.get(k) || []
      list.push(r)
      byReq.set(k, list)
    }
    const out: SheetRow[] = []
    let lot = 1
    for (const [, group] of byReq) {
      const jobCards = group.map((g) => g.jobCardNo)
      const reqId = data.requests.find((x) => x.requestNo === group[0].requestNo)?.id || ''
      if (reqId) {
        const built = buildPairRows(reqId, group[0].lotNo || lot, avg, silverStrip, lead, pur)
        built[0].jobCardNo = jobCards[0] || ''
        built[1].jobCardNo = jobCards[1] || jobCards[0] || ''
        out.push(...built)
      } else {
        out.push(
          ...group.map((g) => ({
            ...g,
            silver: silverStrip.toFixed(1),
            lead: lead.toFixed(1),
          })),
        )
      }
      lot += 1
    }
    return out
  }

  const buildPairRows = (
    reqId: string,
    lotNo: number,
    avg: number,
    silverStrip: number,
    lead: number,
    pur: string,
  ): SheetRow[] => {
    const req = data.requests.find((r) => r.id === reqId)
    const rough =
      data.roughSheets.find((r) => r.requestNo === req?.requestNo && r.status !== 'Rejected') ||
      data.roughSheets.find((r) => r.jobCardNo && r.jobCardNo === req?.jobCardNo)
    const drawn = sampleDrawnMgFromRequest(Number(rough?.sampleWeight) || 0, pur)
    const [sw1, sw2] = splitSampleWeights(drawn)
    const w1 = expectedWotgcaa(sw1, pur, avg, 0.02)
    const w2 = expectedWotgcaa(sw2, pur, avg, -0.01)
    const f1 = finenessPpt(sw1, w1)
    const f2 = finenessPpt(sw2, w2)
    const mean = Number(((f1 + f2) / 2).toFixed(3))
    const base = {
      partyName: req?.partyName || '',
      requestNo: req?.requestNo || '',
      lotNo,
      jobCardNo: '',
      silver: silverStrip.toFixed(1),
      lead: lead.toFixed(1),
    }
    return [
      {
        key: `row-${Date.now()}-${lotNo}-a`,
        sampleDrawn: drawn.toFixed(3),
        sampleWeight: sw1.toFixed(3),
        wotgcaa: w1.toFixed(3),
        fineness: f1.toFixed(3),
        meanFineness: '0.0',
        ...base,
      },
      {
        key: `row-${Date.now()}-${lotNo}-b`,
        sampleDrawn: drawn.toFixed(3),
        sampleWeight: sw2.toFixed(3),
        wotgcaa: w2.toFixed(3),
        fineness: f2.toFixed(3),
        meanFineness: mean.toFixed(3),
        ...base,
      },
    ]
  }

  /** Gold Shark: purity select → BIS requirements auto-fill. */
  const applyPurityDefaults = (nextPurity: string, opts?: { quiet?: boolean }) => {
    setPurity(nextPurity)
    if (!nextPurity) return
    const bis = getBisDefaults(nextPurity)
    setSilverCg1(String(bis.silverCg1))
    setSilverCg2(String(bis.silverCg2))
    setLeadCg1(bis.lead.toFixed(1))
    setLeadCg2(bis.lead.toFixed(1))

    const stock = loadCgWeights()
      .filter((r) => !r.used)
      .filter((r) => !r.purity || r.purity === nextPurity)
      .sort((a, b) => b.id - a.id)

    let pick1: CgWeightRow | undefined
    let pick2: CgWeightRow | undefined
    if (stock.length >= 2) {
      pick1 = stock[0]
      pick2 = stock[1]
    } else if (stock.length === 1) {
      pick1 = stock[0]
    }

    if (pick1) {
      setCg1Id(String(pick1.id))
      setCopperCg1(String(copperForCg(pick1.weight, nextPurity)))
      setWotgcaa1((pick1.weight - 0.05).toFixed(3))
    } else {
      setCg1Id('')
      setCopperCg1('')
      setWotgcaa1('')
    }
    if (pick2) {
      setCg2Id(String(pick2.id))
      setCopperCg2(String(copperForCg(pick2.weight, nextPurity)))
      setWotgcaa2((pick2.weight - 0.03).toFixed(3))
    } else {
      setCg2Id('')
      setCopperCg2('')
      setWotgcaa2('')
    }

    setCgTick((t) => t + 1)

    if (!opts?.quiet) {
      if (stock.length === 0) {
        toast('Purity set — add Unused CG weights in QM Stock → CG WEIGHT first')
      } else if (stock.length <= 2) {
        window.alert('You have last pair of CG.')
        toast(`BIS fields filled for purity ${nextPurity}`)
      } else {
        toast(`BIS fields auto-filled for purity ${nextPurity}`)
      }
    }

    setRows((prev) => {
      if (!prev.length) return prev
      return autofillRows(prev, nextPurity, Number(avgDelta) || 0, bis.silverStrip, bis.lead)
    })
  }

  const onCgSelect = (which: 1 | 2, id: string) => {
    if (which === 1) setCg1Id(id)
    else setCg2Id(id)
    const row = unusedCg.find((r) => String(r.id) === id)
    if (!row || !purity) return
    const cu = String(copperForCg(row.weight, purity))
    if (which === 1) {
      setCopperCg1(cu)
      if (!wotgcaa1) setWotgcaa1((row.weight - 0.05).toFixed(3))
    } else {
      setCopperCg2(cu)
      if (!wotgcaa2) setWotgcaa2((row.weight - 0.03).toFixed(3))
    }
  }

  useEffect(() => {
    if (!purity) return
    if (cg1Val) setCopperCg1(String(copperForCg(cg1Val, purity)))
    if (cg2Val) setCopperCg2(String(copperForCg(cg2Val, purity)))
  }, [purity, cg1Val, cg2Val])

  const buildBlankLotPair = (
    lotNo: number,
    avg: number,
    silverStrip: number,
    lead: number,
    pur: string,
  ): SheetRow[] => {
    const bis = getBisDefaults(pur)
    // Slight per-lot variation like Gold Shark (~330 mg band)
    const drawn = Number((bis.sampleDrawnSeed + ((lotNo * 17) % 9) * 0.37 + lotNo * 0.11).toFixed(3))
    const [sw1, sw2] = splitSampleWeights(drawn)
    const w1 = expectedWotgcaa(sw1, pur, avg, 0.02 + (lotNo % 3) * 0.01)
    const w2 = expectedWotgcaa(sw2, pur, avg, -0.01 - (lotNo % 2) * 0.01)
    const f1 = finenessPpt(sw1, w1)
    const f2 = finenessPpt(sw2, w2)
    const mean = Number(((f1 + f2) / 2).toFixed(3))
    const stamp = Date.now()
    const base = {
      partyName: '',
      requestNo: '',
      lotNo,
      jobCardNo: '',
      silver: silverStrip.toFixed(1),
      lead: lead.toFixed(1),
      sampleDrawn: drawn.toFixed(3),
    }
    return [
      {
        key: `blank-${stamp}-${lotNo}-a`,
        sampleWeight: sw1.toFixed(3),
        wotgcaa: w1.toFixed(3),
        fineness: f1.toFixed(3),
        meanFineness: '0.0',
        ...base,
      },
      {
        key: `blank-${stamp}-${lotNo}-b`,
        sampleWeight: sw2.toFixed(3),
        wotgcaa: w2.toFixed(3),
        fineness: f2.toFixed(3),
        meanFineness: mean.toFixed(3),
        ...base,
      },
    ]
  }

  /** Gold Shark: create exactly No. of Rows (default 22) — no job selection required. */
  const generateSheetRows = (count?: number): SheetRow[] => {
    const pur = purity || '916'
    const bis = getBisDefaults(pur)
    const avg = Number(avgDelta) || 0
    const target = Math.max(2, Math.min(50, count ?? (Number(noOfRows) || 22)))
    const pairCount = Math.ceil(target / 2)
    const next: SheetRow[] = []
    for (let i = 0; i < pairCount; i++) {
      next.push(...buildBlankLotPair(i + 1, avg, bis.silverStrip, bis.lead, pur))
    }
    return next.slice(0, target)
  }

  const fillJobs = () => {
    if (!purity) {
      toast('Select Purity first (BIS auto-fill)')
      return
    }
    // CG Auto / Cornet: no separate jobs — fill N blank BIS rows
    if (noJobPick) {
      const next = generateSheetRows()
      setRows(next)
      toast(`${next.length} rows ready — paste Job Card No (1_8080132061 …) then Create Sheet`)
      return
    }
    if (selectedJobs.length === 0) {
      toast('Search and select at least one job')
      return
    }
    const bis = getBisDefaults(purity)
    const avg = Number(avgDelta) || 0
    const target = Math.max(2, Number(noOfRows) || 22)
    const maxPairs = Math.ceil(target / 2)
    const picked = selectedJobs.slice(0, maxPairs)
    const next: SheetRow[] = []
    picked.forEach((id, i) => {
      next.push(...buildPairRows(id, i + 1, avg, bis.silverStrip, bis.lead, purity))
    })
    // Pad to No. of Rows if fewer jobs selected (Gold Shark always shows full row count)
    while (next.length < target) {
      const lot = Math.floor(next.length / 2) + 1
      next.push(...buildBlankLotPair(lot, avg, bis.silverStrip, bis.lead, purity))
    }
    setRows(next.slice(0, target))
    toast(`${target} rows filled — enter Job Card No (lot_jobcard)`)
  }

  const createSheet = () => {
    if (!purity) {
      toast('Select Purity first')
      return
    }

    // Gold Shark: Create Sheet builds N rows if table empty (no job pick needed)
    let sheetRows = rows
    if (sheetRows.length === 0) {
      sheetRows = generateSheetRows()
      setRows(sheetRows)
    }

    const avg = Number(avgDelta) || 0
    for (const row of sheetRows) {
      if (!row.requestNo) continue
      const req = data.requests.find((r) => r.requestNo === row.requestNo)
      if (!req) continue
      store.addFireAssay({
        requestNo: req.requestNo,
        partyName: req.partyName,
        sampleWeight: Number(row.sampleWeight),
        purityFound: Number(row.fineness),
        declaredPurity: purity,
        status: 'Completed',
        analyst: 'Lab',
        assayType: meta.assayType,
        assayNo: `FS-${sheetNo}`,
      })
      store.updateRequestStatus(req.id, 'Assayed')
    }

    // Persist sheet assay even without linked requests (CG Auto blank lots)
    if (!sheetRows.some((r) => r.requestNo)) {
      store.addFireAssay({
        requestNo: `SHEET-${sheetNo}`,
        partyName: 'Fire Assay Sheet',
        sampleWeight: Number(sheetRows[0]?.sampleWeight) || 0,
        purityFound: Number(sheetRows[1]?.meanFineness) || Number(sheetRows[0]?.fineness) || 0,
        declaredPurity: purity,
        status: 'Completed',
        analyst: 'Lab',
        assayType: meta.assayType,
        assayNo: `FS-${sheetNo}`,
      })
    }

    const ids = [Number(cg1Id), Number(cg2Id)].filter((n) => n > 0)
    markCgWeightsUsed(ids)
    setCgTick((t) => t + 1)

    const sheet: ManakFireAssaySheet = {
      version: 1,
      source: 'shrija-hallmark-suite',
      createdAt: new Date().toISOString(),
      purity,
      shift,
      sheetNo: String(sheetNo),
      assayType: meta.assayType,
      cg: {
        cg1Id: Number(cg1Id) || undefined,
        cg2Id: Number(cg2Id) || undefined,
        cg1: cg1Val,
        cg2: cg2Val,
        silverCg1: Number(silverCg1) || 0,
        silverCg2: Number(silverCg2) || 0,
        copperCg1: Number(copperCg1) || 0,
        copperCg2: Number(copperCg2) || 0,
        leadCg1: Number(leadCg1) || 4,
        leadCg2: Number(leadCg2) || 4,
        wotgcaa1: Number(wotgcaa1) || 0,
        wotgcaa2: Number(wotgcaa2) || 0,
        delta1: Number(delta1) || 0,
        delta2: Number(delta2) || 0,
        avgDelta: avg,
      },
      rows: sheetRows.map((r, i) => {
        const { lotNo } = parseLotJobCard(r.jobCardNo)
        const lot = r.lotNo || lotNo || Math.floor(i / 2) + 1
        return {
          lotNo: lot,
          jobCardNo: r.jobCardNo.trim() || `${lot}_`,
          sampleDrawn: Number(r.sampleDrawn) || 0,
          sampleWeight: Number(r.sampleWeight) || 0,
          silver: Number(r.silver) || 0,
          copper: 0,
          lead: Number(r.lead) || 4,
          wotgcaa: Number(r.wotgcaa) || 0,
          fineness: Number(r.fineness) || 0,
          meanFineness: Number(r.meanFineness) || 0,
          partyName: r.partyName,
          requestNo: r.requestNo,
        }
      }),
    }

    publishManakFireAssaySheet(sheet)
    try {
      void navigator.clipboard.writeText(JSON.stringify(sheet, null, 2))
    } catch {
      /* ignore */
    }

    // Gold Shark: do NOT open Chrome — open Manak yourself, select Lot No; extension fills
    toast(
      `Sheet FS-${sheetNo} ready (${sheetRows.length} rows). Open Manak → select Lot No — extension fills.`,
    )
  }

  const updateRow = (key: string, patch: Partial<SheetRow>) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
      const byReq = new Map<string, number[]>()
      next.forEach((r, idx) => {
        const sw = Number(r.sampleWeight)
        const w = Number(r.wotgcaa)
        if (sw > 0 && w > 0) r.fineness = finenessPpt(sw, w).toFixed(3)
        const k = r.requestNo || String(Math.floor(idx / 2))
        const list = byReq.get(k) || []
        list.push(idx)
        byReq.set(k, list)
      })
      for (const idxs of byReq.values()) {
        if (idxs.length < 2) continue
        const a = next[idxs[0]]
        const b = next[idxs[1]]
        const mean = ((Number(a.fineness) + Number(b.fineness)) / 2).toFixed(3)
        a.meanFineness = '0.0'
        b.meanFineness = mean
        if (patch.jobCardNo != null && (key === a.key || key === b.key)) {
          a.jobCardNo = patch.jobCardNo
          b.jobCardNo = patch.jobCardNo
        }
      }
      return [...next]
    })
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
    const sample = ['330.310', '1_8080132061', '163.655', '373.3', '4.0', '150.135', '', '']
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
        const fineness = c[6] || (sw > 0 && w > 0 ? finenessPpt(sw, w).toFixed(3) : '')
        return {
          key: `upload-${Date.now()}-${i}`,
          sampleDrawn: c[0] || sampleWeight,
          jobCardNo: c[1] || '',
          sampleWeight,
          silver: c[3] || '',
          lead: c[4] || '4.0',
          wotgcaa,
          fineness,
          meanFineness: c[7] || (i % 2 === 1 ? fineness : '0.0'),
          partyName: '',
          requestNo: '',
          lotNo: Math.floor(i / 2) + 1,
        }
      })
      setRows(nextRows)
      toast(`Uploaded ${nextRows.length} row(s)`)
    }
    reader.readAsText(file)
    if (excelInputRef.current) excelInputRef.current.value = ''
  }

  return (
    <div className="cg-assay-page">
      <div className="cg-tabs">
        {mode === 'cg-auto' ? (
          <button
            type="button"
            className="cg-tab active"
            onClick={() => navigate('/create-fire-assay/cg-auto')}
          >
            Cg Auto Fire Assay
          </button>
        ) : (
          <button
            type="button"
            className={`cg-tab ${isSheetMode && !isManual ? 'active' : ''}`}
            onClick={() => navigate('/create-fire-assay/cornet-auto')}
          >
            Cornet Fire Assay
          </button>
        )}
        <button
          type="button"
          className={`cg-tab ${isManual ? 'active' : ''}`}
          onClick={() => navigate('/create-fire-assay/manual')}
        >
          Manual Fire Assay
        </button>
      </div>

      <div className="panel cg-form-panel">
        <p className="cg-flow-hint">
          {noJobPick
            ? 'Flow: CG WEIGHT add → Select Purity (BIS auto-fill) → Create Sheet makes 22 rows → paste Job Card (1_8080132061) → open Manak yourself → select Lot No (extension fills). Chrome does not open.'
            : 'Flow: Select Purity → Fill Jobs → Job Card → Create Sheet → Manak extension.'}
        </p>
        <div className="cg-form-grid">
          <div className="field">
            <label>Select Purity</label>
            <select value={purity} onChange={(e) => applyPurityDefaults(e.target.value)}>
              <option value="">Select</option>
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
              <option value="">Select</option>
              <option>Day</option>
              <option>Night</option>
            </select>
          </div>
          <div className="field">
            <label>Sheet no</label>
            <select value={sheetNo} onChange={(e) => setSheetNo(e.target.value)}>
              <option value="">Select</option>
              {['1', '2', '3', '4', '5', '6', '7', '8'].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>No. of Rows</label>
            <input
              type="number"
              min="2"
              max="50"
              value={noOfRows}
              onChange={(e) => setNoOfRows(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Silver CG1</label>
            <input
              placeholder="Silver CG1"
              value={silverCg1}
              onChange={(e) => setSilverCg1(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Silver CG2</label>
            <input
              placeholder="Silver CG2"
              value={silverCg2}
              onChange={(e) => setSilverCg2(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Lead Cg1</label>
            <input
              placeholder="Lead Cg1"
              value={leadCg1}
              onChange={(e) => setLeadCg1(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Lead CG2</label>
            <input
              placeholder="Lead CG2"
              value={leadCg2}
              onChange={(e) => setLeadCg2(e.target.value)}
            />
          </div>

          <div className="field">
            <label>WOTGCAA1</label>
            <input
              placeholder="WOTGCAA1"
              value={wotgcaa1}
              onChange={(e) => setWotgcaa1(e.target.value)}
            />
          </div>
          <div className="field">
            <label>WOTGCAA2</label>
            <input
              placeholder="WOTGCAA2"
              value={wotgcaa2}
              onChange={(e) => setWotgcaa2(e.target.value)}
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
            <label>CG1</label>
            <select value={cg1Id} onChange={(e) => onCgSelect(1, e.target.value)}>
              <option value="">Select CG1</option>
              {unusedCg.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.weight.toFixed(3)} (#{r.id})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>CG2</label>
            <select value={cg2Id} onChange={(e) => onCgSelect(2, e.target.value)}>
              <option value="">Select CG2</option>
              {unusedCg.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.weight.toFixed(3)} (#{r.id})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Delta In Mg 1</label>
            <input placeholder="Delta1" value={delta1} readOnly className="table-input-disabled" />
          </div>
          <div className="field">
            <label>Delta In Mg 2</label>
            <input placeholder="Delta2" value={delta2} readOnly className="table-input-disabled" />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Average Delta In Mg</label>
            <input
              placeholder="average-delta"
              value={avgDelta}
              readOnly
              className="table-input-disabled"
            />
          </div>
        </div>

        {!noJobPick && (
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
                  {jobOptions.slice(0, 10).map((r) => (
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
                        {r.jobCardNo ? ` · JC ${r.jobCardNo}` : ''}
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
            <div className="cg-count">Count: {selectedJobs.length || ''}</div>
          </div>
        )}

        {noJobPick && (
          <div className="cg-count" style={{ marginTop: '0.85rem' }}>
            Rows: {rows.length || Number(noOfRows) || 22} (No. of Rows)
          </div>
        )}

        <div className="form-actions">
          {!noJobPick && (
            <button type="button" className="btn btn-navy" onClick={fillJobs}>
              Fill Jobs
            </button>
          )}
          {noJobPick && (
            <button type="button" className="btn btn-navy" onClick={fillJobs}>
              Fill Rows
            </button>
          )}
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
                  <td colSpan={8} className="empty-state">
                    {noJobPick
                      ? 'Select Purity → Create Sheet (or Fill Rows) for 22 BIS rows. Job Card paste later; open Manak yourself + select Lot.'
                      : 'Select purity → Fill Jobs. Job Card stays empty until you paste Manak lot nos.'}
                  </td>
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
                    <td>
                      <input
                        className="table-input"
                        placeholder="Enter Job Card No"
                        value={row.jobCardNo}
                        onChange={(e) => updateRow(row.key, { jobCardNo: e.target.value })}
                      />
                    </td>
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
