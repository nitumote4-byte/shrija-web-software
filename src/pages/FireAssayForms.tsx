import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui'
import { getSession } from '../data/auth'
import { store } from '../data/store'
import {
  blankLotSampleDrawnMg,
  blankLotSplitSeed,
  blankLotWotgcaaJitter,
  copperForCg,
  deltaMg,
  getBisDefaults,
  leadGramsForSample,
  JOB_PAIR_WOTGCAA_JITTER,
  sampleDrawnMgFromRequest,
  seedStripPairAssay,
  splitSampleWeights,
} from '../data/fireAssayBis'
import {
  baseJobCardNumberFromRaw,
  findDuplicateLotQualifiedJob,
  lotQualifiedJobKey,
  parseLotJobCard,
} from '../data/fireAssayJobCard'
import { finenessFromMasses, pairMeanFineness } from '../data/fireAssayViewLayout'
import {
  fireAssaySheetSelectOptions,
  getFireAssaySheet,
  listFireAssaySheetNos,
  nextAvailableSheetNo,
  parseFireAssaySheetNumber,
  publishManakFireAssaySheet,
  sheetNumberForNewSheetGeneration,
  todayFireAssayDate,
  type ManakFireAssaySheet,
} from '../data/manakFireAssayBridge'
import { hasAvailableCgWeightForSheet } from '../data/cgWeightAvailability'
import { applyFireAssayStockConsumption } from '../data/fireAssayConsumption'
import { parseFireAssaySpreadsheet } from '../utils/fireAssayExcelImport'
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

function FireAssaySheet({ mode }: { mode: Mode }) {
  const data = store.getAllRaw()
  const navigate = useNavigate()
  const { toast, Toast } = useToast()
  const meta = MODE_META[mode]
  const excelInputRef = useRef<HTMLInputElement>(null)
  const [cgTick, setCgTick] = useState(0)

  const [purity, setPurity] = useState('')
  const [shift, setShift] = useState('Day')
  const [sheetDate, setSheetDate] = useState(() => todayFireAssayDate())
  const [sheetNo, setSheetNo] = useState('')
  const [noOfRows, setNoOfRows] = useState('22')
  const [sheetTick, setSheetTick] = useState(0)

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

  const allCg = useMemo(() => {
    void cgTick
    return loadCgWeights()
  }, [cgTick])

  const cg1Row = allCg.find((r) => String(r.id) === cg1Id)
  const cg2Row = allCg.find((r) => String(r.id) === cg2Id)
  const cg1Val = cg1Row?.weight ?? 0
  const cg2Val = cg2Row?.weight ?? 0

  const cgSelectRows = useMemo(() => {
    const byId = new Map<number, CgWeightRow>()
    for (const r of unusedCg) byId.set(r.id, r)
    if (cg1Row) byId.set(cg1Row.id, cg1Row)
    if (cg2Row) byId.set(cg2Row.id, cg2Row)
    return [...byId.values()].sort((a, b) => b.id - a.id)
  }, [unusedCg, cg1Row, cg2Row])

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
    const session = getSession()
    const atMain = session?.centreKind !== 'osc'
    return data.requests.filter((r) => {
      if (selectedJobs.includes(r.id)) return false
      if (r.status === 'Billed' || r.status === 'Delivered' || r.status === 'Hallmarked') return false
      // OSC samples only appear at Main after Send to Main
      const isOscJob = r.centreKind === 'osc' || Boolean(r.oscTransferStatus)
      if (isOscJob) {
        if (!atMain) return false
        if (
          r.oscTransferStatus !== 'sent_to_main' &&
          r.oscTransferStatus !== 'assay_in_lab'
        ) {
          return false
        }
      }
      if (!q) return true
      return (
        r.requestNo.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        (r.jobCardNo || '').toLowerCase().includes(q) ||
        (r.oscTransferStatus || '').includes(q)
      )
    })
  }, [data.requests, jobQuery, selectedJobs])

  const toggleJob = (id: string) => {
    setSelectedJobs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const usedSheetNos = useMemo(() => {
    void sheetTick
    if (!purity) return [] as string[]
    return listFireAssaySheetNos(purity, shift || 'Day', sheetDate)
  }, [purity, shift, sheetDate, sheetTick])

  const suggestedSheetNo = useMemo(() => {
    void sheetTick
    if (!purity) return ''
    return nextAvailableSheetNo(purity, shift || 'Day', sheetDate)
  }, [purity, shift, sheetDate, sheetTick])

  const sheetSelectOptions = useMemo(
    () => fireAssaySheetSelectOptions(usedSheetNos, suggestedSheetNo),
    [usedSheetNos, suggestedSheetNo],
  )

  const syncNextSheetNo = (pur: string, sh: string, date = sheetDate) => {
    if (!pur) {
      setSheetNo('')
      return
    }
    setSheetNo(nextAvailableSheetNo(pur, sh || 'Day', date))
    setSheetTick((t) => t + 1)
  }

  /** Same (jobCard + lotNo) on a different lot pair = duplicate. Same pair sharing value is OK. */
  const findDuplicateJob = (value: string, rowKey: string, list: SheetRow[]) =>
    findDuplicateLotQualifiedJob(value, rowKey, list)

  const assaySheetNumber = (): number => parseFireAssaySheetNumber(sheetNo)

  /** Re-apply job-level Model C F* to a strip pair, keeping existing sample weights. */
  const reseedPairFromJob = (
    a: SheetRow,
    b: SheetRow,
    pur: string,
    avg: number,
    sheetNumber: number,
    jobCardRaw: string,
  ) => {
    const baseJob = baseJobCardNumberFromRaw(jobCardRaw)
    if (!baseJob) return
    const sw1 = Number(a.sampleWeight) || 0
    const sw2 = Number(b.sampleWeight) || 0
    if (!(sw1 > 0 && sw2 > 0)) return
    const lotNo = a.lotNo || b.lotNo || 1
    const hasJob = Boolean(jobCardRaw.trim())
    const [j1, j2] = hasJob ? JOB_PAIR_WOTGCAA_JITTER : blankLotWotgcaaJitter(lotNo)
    const seeded = seedStripPairAssay(sw1, sw2, pur, avg, j1, j2, {
      sheetNumber,
      baseJobCardNumber: baseJob,
    })
    a.wotgcaa = seeded.wotgcaa1.toFixed(3)
    b.wotgcaa = seeded.wotgcaa2.toFixed(3)
    a.fineness = seeded.fineness1.toFixed(3)
    b.fineness = seeded.fineness2.toFixed(3)
    const mean = pairMeanFineness(a.fineness, b.fineness)
    a.meanFineness = mean.first
    b.meanFineness = mean.second
  }

  const reseedAllAssignedJobs = (list: SheetRow[], pur: string, avg: number): SheetRow[] => {
    const sheetNumber = assaySheetNumber()
    const next = list.map((r) => ({ ...r }))
    for (let i = 0; i + 1 < next.length; i += 2) {
      const jc = (next[i].jobCardNo || next[i + 1].jobCardNo || '').trim()
      if (!jc) continue
      reseedPairFromJob(next[i], next[i + 1], pur, avg, sheetNumber, jc)
    }
    return next
  }

  function autofillRows(
    prev: SheetRow[],
    pur: string,
    avg: number,
    silverStrip: number,
    lead: number,
  ): SheetRow[] {
    // Group by strip pair, not by Request No: one voucher may carry several
    // items, and each Job Card No must keep its own lot.
    const byLot = new Map<string, SheetRow[]>()
    for (const r of prev) {
      const qualified = lotQualifiedJobKey(r.jobCardNo)
      const k = qualified
        ? `lotjob:${qualified}`
        : r.lotNo
          ? `lot:${r.lotNo}`
          : `row:${r.key}`
      const list = byLot.get(k) || []
      list.push(r)
      byLot.set(k, list)
    }
    const out: SheetRow[] = []
    let lot = 1
    const sheetNumber = assaySheetNumber()
    for (const [, group] of byLot) {
      const jobCards = group.map((g) => g.jobCardNo)
      const reqId = data.requests.find((x) => x.requestNo === group[0].requestNo)?.id || ''
      if (reqId) {
        const built = buildPairRows(
          reqId,
          group[0].lotNo || lot,
          avg,
          silverStrip,
          lead,
          pur,
          sheetNumber,
          jobCards[0],
        )
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
    return reseedAllAssignedJobs(out, pur, avg)
  }

  const buildPairRows = (
    reqId: string,
    lotNo: number,
    avg: number,
    silverStrip: number,
    lead: number,
    pur: string,
    sheetNumber: number,
    jobCardNo?: string,
  ): SheetRow[] => {
    const req = data.requests.find((r) => r.id === reqId)
    // Job Card No picks the exact item when one Request No holds several
    const card = (parseLotJobCard(jobCardNo || '').jobCard || jobCardNo || '').trim()
    const rough =
      (card
        ? data.roughSheets.find(
            (r) => (parseLotJobCard(r.jobCardNo || '').jobCard || r.jobCardNo) === card,
          )
        : undefined) ||
      data.roughSheets.find((r) => r.requestNo === req?.requestNo && r.status !== 'Rejected') ||
      data.roughSheets.find((r) => r.jobCardNo && r.jobCardNo === req?.jobCardNo)
    const drawn = sampleDrawnMgFromRequest(Number(rough?.sampleWeight) || 0, pur)
    const [sw1, sw2] = splitSampleWeights(drawn, lotNo)
    const baseJob =
      baseJobCardNumberFromRaw(jobCardNo || '') ||
      baseJobCardNumberFromRaw(req?.jobCardNo || '') ||
      0
    const seeded = seedStripPairAssay(
      sw1,
      sw2,
      pur,
      avg,
      JOB_PAIR_WOTGCAA_JITTER[0],
      JOB_PAIR_WOTGCAA_JITTER[1],
      {
        sheetNumber,
        baseJobCardNumber: baseJob,
      },
    )
    const foil = (sw: number) => leadGramsForSample(sw > 0 ? sw : lead).toFixed(1)
    const mean = pairMeanFineness(seeded.fineness1.toFixed(3), seeded.fineness2.toFixed(3))
    const base = {
      partyName: req?.partyName || '',
      requestNo: req?.requestNo || '',
      lotNo,
      jobCardNo: '',
      silver: silverStrip.toFixed(1),
      lead: foil(sw1),
    }
    return [
      {
        key: `row-${Date.now()}-${lotNo}-a`,
        sampleDrawn: drawn.toFixed(3),
        sampleWeight: sw1.toFixed(3),
        wotgcaa: seeded.wotgcaa1.toFixed(3),
        fineness: seeded.fineness1.toFixed(3),
        meanFineness: mean.first,
        ...base,
      },
      {
        key: `row-${Date.now()}-${lotNo}-b`,
        sampleDrawn: drawn.toFixed(3),
        sampleWeight: sw2.toFixed(3),
        wotgcaa: seeded.wotgcaa2.toFixed(3),
        fineness: seeded.fineness2.toFixed(3),
        meanFineness: mean.second,
        ...base,
        lead: foil(sw2),
      },
    ]
  }

  /** Purity select → silver / lead / copper working defaults (IS 1418 lead & high-purity Cu). */
  const applyPurityDefaults = (
    nextPurity: string,
    opts?: { quiet?: boolean; freshSheet?: boolean; sheetNoOverride?: string; dateOverride?: string },
  ) => {
    setPurity(nextPurity)
    if (!nextPurity) {
      setSheetNo('')
      return
    }
    const activeDate = opts?.dateOverride ?? sheetDate
    const nextAvailable = nextAvailableSheetNo(nextPurity, shift || 'Day', activeDate)
    const sheetNoForGeneration =
      opts?.sheetNoOverride != null && String(opts.sheetNoOverride).trim() !== ''
        ? String(opts.sheetNoOverride).trim()
        : nextAvailable
    if (opts?.sheetNoOverride != null) {
      setSheetNo(opts.sheetNoOverride)
      setSheetTick((t) => t + 1)
    } else {
      // Auto next sheet no for THIS date (if that date has sheet 1 → 2). State flushes after this tick.
      syncNextSheetNo(nextPurity, shift || 'Day', activeDate)
    }
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
      setLeadCg1(leadGramsForSample(pick1.weight).toFixed(1))
      setWotgcaa1((pick1.weight - 0.05).toFixed(3))
    } else {
      setCg1Id('')
      setCopperCg1('')
      setWotgcaa1('')
    }
    if (pick2) {
      setCg2Id(String(pick2.id))
      setCopperCg2(String(copperForCg(pick2.weight, nextPurity)))
      setLeadCg2(leadGramsForSample(pick2.weight).toFixed(1))
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

    if (opts?.freshSheet) {
      setSelectedJobs([])
      setJobQuery('')
    }

    // Selecting purity auto-creates No. of Rows (Job Card empty for paste)
    if (noJobPick) {
      // A new sheet must not keep the previous sheet's job cards or lot values.
      const prevCards = opts?.freshSheet ? [] : rows.map((r) => r.jobCardNo)
      const sheetNumber = sheetNumberForNewSheetGeneration(sheetNoForGeneration, nextAvailable)
      // Fresh sheets must not seed from the previous sheet's avgDelta.
      const generated = generateSheetRowsFor(
        nextPurity,
        undefined,
        sheetNumber,
        opts?.freshSheet ? 0 : undefined,
      )
      const withCards = generated.map((r, i) => ({
        ...r,
        jobCardNo: prevCards[i] || '',
        lotNo: prevCards[i] ? parseLotJobCard(prevCards[i]).lotNo || r.lotNo : r.lotNo,
      }))
      setRows(reseedAllAssignedJobs(withCards, nextPurity, Number(avgDelta) || 0))
      return
    }

    if (opts?.freshSheet) {
      setRows([])
      return
    }

    setRows((prev) => {
      if (!prev.length) return prev
      return autofillRows(prev, nextPurity, Number(avgDelta) || 0, bis.silverStrip, bis.lead)
    })
  }

  /** Clear previous sheet grid/CG picks, then refill from current purity + unused CG. */
  const startNewSheet = (nextNo: string, opts?: { quiet?: boolean; dateOverride?: string }) => {
    if (!purity) {
      toast('Pehle Purity select karo')
      return
    }
    applyPurityDefaults(purity, {
      quiet: true,
      freshSheet: true,
      sheetNoOverride: nextNo,
      dateOverride: opts?.dateOverride,
    })
    if (!opts?.quiet) toast(`New Sheet No ${nextNo} — Create Sheet dabao`)
  }

  const onSheetDateChange = (nextDate: string) => {
    setSheetDate(nextDate)
    setSheetNo('')
    setSheetTick((t) => t + 1)
    if (!purity) return
    const nextNo = nextAvailableSheetNo(purity, shift || 'Day', nextDate)
    startNewSheet(nextNo, { quiet: true, dateOverride: nextDate })
  }

  const applySavedCg = (saved: ManakFireAssaySheet) => {
    const cg = saved.cg || ({} as ManakFireAssaySheet['cg'])
    setSilverCg1(cg.silverCg1 ? String(cg.silverCg1) : '')
    setSilverCg2(cg.silverCg2 ? String(cg.silverCg2) : '')
    setLeadCg1(cg.leadCg1 != null ? String(cg.leadCg1) : '')
    setLeadCg2(cg.leadCg2 != null ? String(cg.leadCg2) : '')
    setWotgcaa1(cg.wotgcaa1 ? String(cg.wotgcaa1) : '')
    setWotgcaa2(cg.wotgcaa2 ? String(cg.wotgcaa2) : '')
    setCopperCg1(cg.copperCg1 ? String(cg.copperCg1) : '')
    setCopperCg2(cg.copperCg2 ? String(cg.copperCg2) : '')
    setCg1Id(cg.cg1Id ? String(cg.cg1Id) : '')
    setCg2Id(cg.cg2Id ? String(cg.cg2Id) : '')
    setCgTick((t) => t + 1)
  }

  const loadSavedSheetRows = (n: string) => {
    setSheetNo(n)
    const saved = getFireAssaySheet(purity, shift || 'Day', n, sheetDate)
    if (!saved) return
    applySavedCg(saved)
    const source = saved.viewRows?.length ? saved.viewRows : saved.rows || []
    if (!source.length) return
    setRows(
      source.map((r, i) => ({
        key: `saved-${saved.sheetNo}-${i}-${r.lotNo || Math.floor(i / 2) + 1}`,
        sampleDrawn: (Number(r.sampleDrawn) || 0).toFixed(3),
        jobCardNo: r.jobCardNo || '',
        sampleWeight: (Number(r.sampleWeight) || 0).toFixed(3),
        silver: (Number(r.silver) || 0).toFixed(1),
        lead: (Number(r.lead) || 0).toFixed(1),
        wotgcaa: (Number(r.wotgcaa) || 0).toFixed(3),
        fineness: (Number(r.fineness) || 0).toFixed(3),
        meanFineness: (Number(r.meanFineness) || 0).toFixed(3),
        partyName: r.partyName || '',
        requestNo: r.requestNo || '',
        lotNo: r.lotNo || Math.floor(i / 2) + 1,
      })),
    )
  }

  const onCgSelect = (which: 1 | 2, id: string) => {
    if (which === 1) setCg1Id(id)
    else setCg2Id(id)
    const row = allCg.find((r) => String(r.id) === id)
    if (!row || !purity) return
    const cu = String(copperForCg(row.weight, purity))
    if (which === 1) {
      setCopperCg1(cu)
      setLeadCg1(leadGramsForSample(row.weight).toFixed(1))
      if (!wotgcaa1) setWotgcaa1((row.weight - 0.05).toFixed(3))
    } else {
      setCopperCg2(cu)
      setLeadCg2(leadGramsForSample(row.weight).toFixed(1))
      if (!wotgcaa2) setWotgcaa2((row.weight - 0.03).toFixed(3))
    }
  }

  useEffect(() => {
    if (!purity) return
    if (cg1Val) setCopperCg1(String(copperForCg(cg1Val, purity)))
    if (cg2Val) setCopperCg2(String(copperForCg(cg2Val, purity)))
  }, [purity, cg1Val, cg2Val])

  /** Live proof correction: when avgDelta changes, recalculate sample fineness only. */
  useEffect(() => {
    const avg = Number(avgDelta) || 0
    setRows((prev) => {
      if (!prev.length) return prev
      const next = prev.map((r) => ({
        ...r,
        fineness: finenessFromMasses(r.sampleWeight, r.wotgcaa, avg),
      }))
      for (let i = 0; i + 1 < next.length; i += 2) {
        const mean = pairMeanFineness(next[i].fineness, next[i + 1].fineness)
        next[i].meanFineness = mean.first
        next[i + 1].meanFineness = mean.second
      }
      return next
    })
  }, [avgDelta])

  const buildBlankLotPair = (
    lotNo: number,
    avg: number,
    silverStrip: number,
    lead: number,
    pur: string,
    sheetNumber: number,
    jobCardNo = '',
  ): SheetRow[] => {
    // Per-lot Gold Shark band, plus sheet mix so Sheet N+1 is not Sheet N's sequence
    const drawn = blankLotSampleDrawnMg(pur, lotNo, sheetNumber)
    const [sw1, sw2] = splitSampleWeights(drawn, blankLotSplitSeed(lotNo, sheetNumber))
    const [j1, j2] = blankLotWotgcaaJitter(lotNo)
    const seeded = seedStripPairAssay(sw1, sw2, pur, avg, j1, j2, {
      sheetNumber,
      baseJobCardNumber: baseJobCardNumberFromRaw(jobCardNo),
    })
    const foil = (sw: number) => leadGramsForSample(sw > 0 ? sw : lead).toFixed(1)
    const mean = pairMeanFineness(seeded.fineness1.toFixed(3), seeded.fineness2.toFixed(3))
    const stamp = Date.now()
    const base = {
      partyName: '',
      requestNo: '',
      lotNo,
      jobCardNo: '',
      silver: silverStrip.toFixed(1),
      lead: foil(sw1),
      sampleDrawn: drawn.toFixed(3),
    }
    return [
      {
        key: `blank-${stamp}-${lotNo}-a`,
        sampleWeight: sw1.toFixed(3),
        wotgcaa: seeded.wotgcaa1.toFixed(3),
        fineness: seeded.fineness1.toFixed(3),
        meanFineness: mean.first,
        ...base,
      },
      {
        key: `blank-${stamp}-${lotNo}-b`,
        sampleWeight: sw2.toFixed(3),
        wotgcaa: seeded.wotgcaa2.toFixed(3),
        fineness: seeded.fineness2.toFixed(3),
        meanFineness: mean.second,
        ...base,
        lead: foil(sw2),
      },
    ]
  }

  /** Create exactly No. of Rows (default 22) — no job selection required. */
  const generateSheetRowsFor = (
    pur: string,
    count?: number,
    sheetNumberOverride?: number,
    avgOverride?: number,
  ): SheetRow[] => {
    const p = pur || '916'
    const bis = getBisDefaults(p)
    const avg = avgOverride != null ? avgOverride : Number(avgDelta) || 0
    const sheetNumber = sheetNumberForNewSheetGeneration(
      sheetNumberOverride != null && Number.isFinite(sheetNumberOverride) && sheetNumberOverride > 0
        ? sheetNumberOverride
        : assaySheetNumber(),
      nextAvailableSheetNo(p, shift || 'Day', sheetDate),
    )
    const target = Math.max(2, Math.min(50, count ?? (Number(noOfRows) || 22)))
    const pairCount = Math.ceil(target / 2)
    const next: SheetRow[] = []
    for (let i = 0; i < pairCount; i++) {
      next.push(...buildBlankLotPair(i + 1, avg, bis.silverStrip, bis.lead, p, sheetNumber))
    }
    return next.slice(0, target)
  }

  const generateSheetRows = (count?: number) => generateSheetRowsFor(purity || '916', count)

  const fillJobs = () => {
    if (!purity) {
      toast('Select Purity first (BIS auto-fill)')
      return
    }
    // CG Auto / Cornet: no separate jobs — fill N blank BIS rows
    if (noJobPick) {
      const prevCards = rows.map((r) => r.jobCardNo)
      const next = generateSheetRows().map((r, i) => ({
        ...r,
        jobCardNo: prevCards[i] || '',
        lotNo: prevCards[i] ? parseLotJobCard(prevCards[i]).lotNo || r.lotNo : r.lotNo,
      }))
      setRows(reseedAllAssignedJobs(next, purity, Number(avgDelta) || 0))
      toast(`${next.length} rows ready — paste Job Card No (1_8080132061 …) then Create Sheet`)
      return
    }
    if (selectedJobs.length === 0) {
      toast('Search and select at least one job')
      return
    }
    const bis = getBisDefaults(purity)
    const avg = Number(avgDelta) || 0
    const sheetNumber = sheetNumberForNewSheetGeneration(
      assaySheetNumber(),
      nextAvailableSheetNo(purity, shift || 'Day', sheetDate),
    )
    const target = Math.max(2, Number(noOfRows) || 22)
    const maxPairs = Math.ceil(target / 2)
    const picked = selectedJobs.slice(0, maxPairs)
    store.markOscAssayInLab(picked)
    const next: SheetRow[] = []
    picked.forEach((id, i) => {
      const req = data.requests.find((r) => r.id === id)
      next.push(
        ...buildPairRows(
          id,
          i + 1,
          avg,
          bis.silverStrip,
          bis.lead,
          purity,
          sheetNumber,
          req?.jobCardNo || '',
        ),
      )
    })
    while (next.length < target) {
      const lot = Math.floor(next.length / 2) + 1
      next.push(...buildBlankLotPair(lot, avg, bis.silverStrip, bis.lead, purity, sheetNumber))
    }
    setRows(next.slice(0, target))
    toast(`${target} rows filled — enter Job Card No (lot_jobcard)`)
  }

  const createSheet = () => {
    if (!purity) {
      toast('Select Purity first')
      return
    }
    if (rows.length === 0) {
      toast('Select Purity first — rows auto-create, then fill Job Card Nos')
      return
    }

    // Jobs count is not fixed — fill whatever lots arrived; remaining 22 rows may stay empty
    const filledRows = rows.filter((r) => r.jobCardNo.trim())
    if (filledRows.length === 0) {
      toast('Fill at least one Job Card No (e.g. 1_127087789). Remaining rows can stay empty.')
      return
    }

    // Block duplicate lot-qualified ids (same job + same lot). Different lots of one job are OK.
    for (const r of filledRows) {
      const dup = findDuplicateJob(r.jobCardNo, r.key, rows)
      if (dup) {
        const parsed = parseLotJobCard(r.jobCardNo)
        const card = (parsed.jobCard || r.jobCardNo).trim()
        toast(`Duplicate Job No ${card} lot ${parsed.lotNo || r.lotNo} — already used on this sheet`)
        return
      }
    }

    // CG comes from QM Stock (including the selected pair after it is marked used).
    const cgStock = loadCgWeights()
    const cg1Weight =
      cg1Row?.weight ?? cgStock.find((r) => String(r.id) === cg1Id)?.weight
    const cg2Weight =
      cg2Row?.weight ?? cgStock.find((r) => String(r.id) === cg2Id)?.weight
    if (!hasAvailableCgWeightForSheet(cg1Weight, cg2Weight)) {
      toast('There is no available CG weight.')
      return
    }

    // Same DATE + Sheet No pe Create Sheet = UPDATE (overwrite). Naya sheet chahiye to Sheet dropdown badlo.
    let activeSheet = String(sheetNo || '').trim()
    if (!activeSheet) {
      activeSheet = nextAvailableSheetNo(purity, shift || 'Day', sheetDate)
      setSheetNo(activeSheet)
    }
    const existingSheet = getFireAssaySheet(purity, shift || 'Day', activeSheet, sheetDate)
    const overwriting = Boolean(existingSheet)

    const sheetRows = rows.map((r, i) => {
      const parsed = parseLotJobCard(r.jobCardNo)
      const lot = parsed.lotNo || r.lotNo || Math.floor(i / 2) + 1
      return { ...r, lotNo: lot }
    })
    setRows(sheetRows)

    const avg = Number(avgDelta) || 0
    const ids = [Number(cg1Id), Number(cg2Id)].filter((n) => n > 0)
    markCgWeightsUsed(ids)
    setCgTick((t) => t + 1)
    setSheetTick((t) => t + 1)
    setSheetNo(String(activeSheet))

    if (!overwriting) {
      const returnedIds: string[] = []
      for (const row of sheetRows) {
        let req = row.requestNo
          ? data.requests.find((r) => r.requestNo === row.requestNo)
          : undefined
        if (!req && row.jobCardNo.trim()) {
          const card = row.jobCardNo.includes('_')
            ? row.jobCardNo.split('_').slice(1).join('_').trim()
            : row.jobCardNo.trim()
          req =
            data.requests.find((r) => (r.jobCardNo || '').trim() === card) ||
            data.requests.find((r) => (r.jobCardNo || '').includes(card))
        }
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
          assayNo: `FS-${activeSheet}`,
          date: sheetDate,
        })
        returnedIds.push(req.id)
      }

      if (returnedIds.length > 0) {
        store.markOscAssayReturned([...new Set(returnedIds)])
      } else if (!sheetRows.some((r) => r.requestNo)) {
        store.addFireAssay({
          requestNo: `SHEET-${activeSheet}`,
          partyName: 'Fire Assay Sheet',
          sampleWeight: Number(sheetRows[0]?.sampleWeight) || 0,
          purityFound: Number(sheetRows[1]?.meanFineness) || Number(sheetRows[0]?.fineness) || 0,
          declaredPurity: purity,
          status: 'Completed',
          analyst: 'Lab',
          assayType: meta.assayType,
          assayNo: `FS-${activeSheet}`,
          date: sheetDate,
        })
      }
    }

    const sheet: ManakFireAssaySheet = {
      version: 1,
      source: 'shrija-hallmark-suite',
      createdAt: existingSheet?.createdAt || new Date().toISOString(),
      date: existingSheet?.date || sheetDate,
      purity,
      shift: shift || 'Day',
      sheetNo: String(activeSheet),
      assayType: meta.assayType,
      cg: {
        cg1Id: Number(cg1Id) || undefined,
        cg2Id: Number(cg2Id) || undefined,
        cg1: Number(cg1Weight) || cg1Val || 0,
        cg2: Number(cg2Weight) || cg2Val || 0,
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
      rows: sheetRows
        .filter((r) => r.jobCardNo.trim())
        .map((r, i) => {
          const parsed = parseLotJobCard(r.jobCardNo)
          const lot = parsed.lotNo || r.lotNo || Math.floor(i / 2) + 1
          const manakJobCard = parsed.jobCard || r.jobCardNo.replace(/^\d+[_\-/]/, '').trim()
          return {
            lotNo: lot,
            jobCardNo: r.jobCardNo.trim(),
            manakJobCard,
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
      // Full 22-row grid for View Fire Assay (empty job cards kept)
      viewRows: sheetRows.map((r, i) => {
        const parsed = parseLotJobCard(r.jobCardNo)
        const lot = parsed.lotNo || r.lotNo || Math.floor(i / 2) + 1
        const manakJobCard = r.jobCardNo.trim()
          ? parsed.jobCard || r.jobCardNo.replace(/^\d+[_\-/]/, '').trim()
          : ''
        return {
          lotNo: lot,
          jobCardNo: r.jobCardNo.trim(),
          manakJobCard,
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

    // Carry each job card's cornet onto its day-sheet row (QM sheet + billing read it there)
    store.applyFireAssayCornet(
      sheet.rows.map((r) => ({
        jobCardNo: r.manakJobCard || r.jobCardNo,
        requestNo: r.requestNo,
        cornet: r.wotgcaa,
      })),
    )
    store.applyFireAssaySampleWeights(
      sheetRows
        .filter((r) => r.jobCardNo.trim())
        .map((r) => ({
          jobCardNo: parseLotJobCard(r.jobCardNo).jobCard || r.jobCardNo,
          requestNo: r.requestNo,
          sampleWeight: r.sampleWeight.trim() === '' ? null : Number(r.sampleWeight),
          sampleDrawn: r.sampleDrawn.trim() === '' ? null : Number(r.sampleDrawn),
        })),
    )

    publishManakFireAssaySheet(sheet)
    applyFireAssayStockConsumption(sheet)
    try {
      void navigator.clipboard.writeText(JSON.stringify(sheet))
    } catch {
      /* ignore */
    }

    toast(
      overwriting
        ? `Sheet FS-${activeSheet} UPDATED — Manak kholo → Auto FS Phase 1, then Phase 2.`
        : `Sheet FS-${activeSheet} ready — Manak kholo → Auto FS Phase 1, then Phase 2. Naya sheet: New Sheet No.`,
    )
  }

  const updateRow = (key: string, patch: Partial<SheetRow>) => {
    if (patch.jobCardNo != null && patch.jobCardNo.trim()) {
      const dup = findDuplicateJob(patch.jobCardNo, key, rows)
      if (dup) {
        toast(`Duplicate Job No — already used on lot ${dup.lotNo}`)
        return
      }
    }
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.key !== key) return r
        const updated = { ...r, ...patch }
        if (patch.jobCardNo != null) {
          const parsed = parseLotJobCard(patch.jobCardNo)
          if (parsed.lotNo > 0) updated.lotNo = parsed.lotNo
        }
        return updated
      })
      // Pair by lot index (every 2 rows)
      const avg = Number(avgDelta) || 0
      const sheetNumber = assaySheetNumber()
      const pur = purity || '916'
      for (let i = 0; i + 1 < next.length; i += 2) {
        const a = next[i]
        const b = next[i + 1]
        if (patch.jobCardNo != null && (key === a.key || key === b.key)) {
          const parsed = parseLotJobCard(patch.jobCardNo)
          a.jobCardNo = patch.jobCardNo
          b.jobCardNo = patch.jobCardNo
          if (parsed.lotNo > 0) {
            a.lotNo = parsed.lotNo
            b.lotNo = parsed.lotNo
          }
          // Job-level Model C: re-seed W from existing SW + shared F* for this base job
          if (patch.jobCardNo.trim()) {
            reseedPairFromJob(a, b, pur, avg, sheetNumber, patch.jobCardNo)
          } else {
            a.fineness = finenessFromMasses(a.sampleWeight, a.wotgcaa, avg)
            b.fineness = finenessFromMasses(b.sampleWeight, b.wotgcaa, avg)
            const mean = pairMeanFineness(a.fineness, b.fineness)
            a.meanFineness = mean.first
            b.meanFineness = mean.second
          }
        } else {
          a.fineness = finenessFromMasses(a.sampleWeight, a.wotgcaa, avg)
          b.fineness = finenessFromMasses(b.sampleWeight, b.wotgcaa, avg)
          const mean = pairMeanFineness(a.fineness, b.fineness)
          a.meanFineness = mean.first
          b.meanFineness = mean.second
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

  const handleExcelUpload = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      void (async () => {
        const buf = reader.result
        if (!(buf instanceof ArrayBuffer)) {
          toast('Could not read file')
          return
        }
        const parsed = await parseFireAssaySpreadsheet(new Uint8Array(buf))
        if (parsed.error) {
          toast(parsed.error)
          return
        }
        if (!parsed.rows.length) {
          toast('File has no sample rows')
          return
        }

        const unused = loadCgWeights().filter((r) => !r.used)
        const matchCgId = (weight: string, skipId: string) => {
          const w = Number(weight)
          if (!(w > 0)) return ''
          const hit = unused.find(
            (r) => String(r.id) !== skipId && Math.abs(r.weight - w) < 0.001,
          )
          return hit ? String(hit.id) : ''
        }
        if (parsed.cg1) {
          const id = matchCgId(parsed.cg1.weight, '')
          if (id) setCg1Id(id)
          if (parsed.cg1.silver) setSilverCg1(parsed.cg1.silver)
          if (parsed.cg1.lead) setLeadCg1(parsed.cg1.lead)
          if (parsed.cg1.wotgcaa) setWotgcaa1(parsed.cg1.wotgcaa)
          if (parsed.cg1.copper) setCopperCg1(parsed.cg1.copper)
        }
        if (parsed.cg2) {
          const id = matchCgId(parsed.cg2.weight, parsed.cg1 ? matchCgId(parsed.cg1.weight, '') : '')
          if (id) setCg2Id(id)
          if (parsed.cg2.silver) setSilverCg2(parsed.cg2.silver)
          if (parsed.cg2.lead) setLeadCg2(parsed.cg2.lead)
          if (parsed.cg2.wotgcaa) setWotgcaa2(parsed.cg2.wotgcaa)
          if (parsed.cg2.copper) setCopperCg2(parsed.cg2.copper)
        }

        const avg = Number(avgDelta) || 0
        const maxRows = Math.min(50, parsed.rows.length)
        const nextRows: SheetRow[] = parsed.rows.slice(0, maxRows).map((c, i) => {
          const sampleWeight = c.sampleWeight || c.sampleDrawn || ''
          const wotgcaa = c.wotgcaa || ''
          const fineness = c.fineness || finenessFromMasses(sampleWeight, wotgcaa, avg)
          return {
            key: `upload-${Date.now()}-${i}`,
            sampleDrawn: c.sampleDrawn || sampleWeight,
            jobCardNo: c.jobCardNo || '',
            sampleWeight,
            silver: c.silver || '',
            lead: c.lead || '4.0',
            wotgcaa,
            fineness,
            meanFineness: c.meanFineness || '',
            partyName: '',
            requestNo: '',
            lotNo: Math.floor(i / 2) + 1,
          }
        })
        for (let i = 0; i + 1 < nextRows.length; i += 2) {
          const a = nextRows[i]
          const b = nextRows[i + 1]
          if (a.meanFineness || b.meanFineness) continue
          const mean = pairMeanFineness(a.fineness, b.fineness)
          a.meanFineness = mean.first
          b.meanFineness = mean.second
        }
        setRows(nextRows)
        setNoOfRows(String(nextRows.length))
        toast(`Uploaded ${nextRows.length} row(s)`)
      })()
    }
    reader.readAsArrayBuffer(file)
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
            ? 'Flow: Select Purity → 22 rows → fill Job Cards (rest empty OK) → Create Sheet → Manak Lot select → Sample Drawn/Button Save → Initial Weight Save → wait timing → M2 auto-fill + Cornet Save.'
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
            <select
              value={shift}
              onChange={(e) => {
                const sh = e.target.value
                setShift(sh)
                if (purity) syncNextSheetNo(purity, sh || 'Day', sheetDate)
              }}
            >
              <option value="">Select</option>
              <option>Day</option>
              <option>Night</option>
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={sheetDate} onChange={(e) => onSheetDateChange(e.target.value)} />
          </div>
          <div className="field">
            <label>Sheet no (same date + no = overwrite)</label>
            <select
              value={sheetNo}
              onChange={(e) => {
                const n = e.target.value
                if (!n) {
                  setSheetNo('')
                  return
                }
                if (!purity) {
                  setSheetNo(n)
                  return
                }
                if (usedSheetNos.includes(n)) {
                  loadSavedSheetRows(n)
                  return
                }
                startNewSheet(n)
              }}
            >
              <option value="">Select</option>
              {sheetSelectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn ghost"
              style={{ marginTop: 6 }}
              onClick={() => {
                if (!purity) {
                  toast('Pehle Purity select karo')
                  return
                }
                startNewSheet(nextAvailableSheetNo(purity, shift || 'Day', sheetDate))
              }}
            >
              New Sheet No
            </button>
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
            <label>CG Weight 1{cg1Val ? ` · ${cg1Val.toFixed(3)} mg` : ''}</label>
            <select value={cg1Id} onChange={(e) => onCgSelect(1, e.target.value)}>
              <option value="">Select CG1</option>
              {cgSelectRows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.weight.toFixed(3)} (#{r.id}{r.used ? ', used' : ''})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Delta In Mg 1</label>
            <input placeholder="Delta1" value={delta1} readOnly className="table-input-disabled" />
          </div>
          <div className="field">
            <label>CG Weight 2{cg2Val ? ` · ${cg2Val.toFixed(3)} mg` : ''}</label>
            <select value={cg2Id} onChange={(e) => onCgSelect(2, e.target.value)}>
              <option value="">Select CG2</option>
              {cgSelectRows.map((r) => (
                <option key={`cg2-${r.id}`} value={r.id}>
                  {r.weight.toFixed(3)} (#{r.id}{r.used ? ', used' : ''})
                </option>
              ))}
            </select>
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
                        {r.centreKind === 'osc' || r.oscTransferStatus
                          ? ` · OSC (${r.oscTransferStatus || 'sample'})`
                          : ''}
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
                      ? 'Select Purity for 22 rows. Fill Job Card only for jobs that arrived — empty rows OK. Then Create Sheet.'
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
