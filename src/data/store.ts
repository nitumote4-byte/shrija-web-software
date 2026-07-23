import { getActiveTenantId } from './tenant'
import { getStoreCache, setStoreCache } from './tenantCache'
import { getSession } from './auth'

export type Party = {
  id: string
  name: string
  phone: string
  address: string
  gstin: string
  createdAt: string
  transactionType: 'Cash' | 'Credit' | 'Bank'
  licenseNo: string
  state: string
  stateCode: string
  groupName: string
  skipMinBill: boolean
  skipRejectedPics: boolean
  skipCutting: boolean
  igstApplicable: boolean
  discount: number
  minBillCalc: boolean
  /** Off-Site outlet scope — OSC users only see their centre */
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type Category = {
  id: string
  name: string
  purity: string
  metal: 'Gold' | 'Silver' | 'Platinum'
  rate: number
}

/** GoldShark-style jewellery type names (New Category module) */
export type JewelleryCategory = {
  id: string
  name: string
}

export type OscTransferStatus =
  | 'pending_local'
  | 'sent_to_main'
  | 'assay_in_lab'
  | 'returned_to_osc'

export type HallmarkRequest = {
  id: string
  requestNo: string
  partyId: string
  partyName: string
  categoryId: string
  categoryName: string
  pieces: number
  weight: number
  purity: string
  status: 'Pending' | 'In Progress' | 'Assayed' | 'Hallmarked' | 'Billed' | 'Delivered'
  source: 'Manual' | 'Auto'
  date: string
  remarks: string
  item?: string
  receiptNo?: string
  jobCardNo?: string
  night?: string
  /** Centre / outlet where job was received */
  centreId?: string
  centreKind?: 'main' | 'osc'
  /** OSC sample handoff to Main lab */
  oscTransferStatus?: OscTransferStatus
  sentToMainAt?: string
  returnedToOscAt?: string
}

export type RoughSheetEntry = {
  id: string
  partyId: string
  partyName: string
  item: string
  pic: number
  weight: number
  purity: string
  sampleWeight: number
  sampleQty: number
  samplingMethod: string
  cml: string
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Completed'
  shift: string
  date: string
  address: string
  requestNo?: string
  jobCardNo?: string
  /** True after Job Card No was saved (Gold Shark: Save before Complete) */
  jobCardSaved?: boolean
  co?: string
  sampleTagId?: string
  cornet?: number
  rejectPic?: number
  centreId?: string
  centreKind?: 'main' | 'osc'
}

/** Line on Invoice Cum Delivery Challan (persisted for reprint / update). */
export type InvoiceLine = {
  description: string
  purity: string
  pcsRec: number
  hm: number
  rej: number
  melt: number
  rate: number
  amount: number
}

export type Invoice = {
  id: string
  invoiceNo: string
  partyName: string
  requestNo: string
  amount: number
  tax: number
  total: number
  status: 'Unpaid' | 'Paid' | 'Partial'
  date: string
  /** Full challan snapshot — pushed to Railway with store flush */
  requestDate?: string
  partyId?: string
  partyAddress?: string
  partyGstin?: string
  partyCml?: string
  placeOfSupply?: string
  stateCode?: string
  sac?: string
  lines?: InvoiceLine[]
  weightReceived?: number
  sampleWeight?: number
  unusedSample?: number
  /** Wt. of Residue / Firebox Sample Returned */
  fireboxScrap?: number
  weightReturned?: number
  cgst?: number
  sgst?: number
  igst?: number
  useIgst?: boolean
  careOf?: string
  invoiceDateTime?: string
  updatedAt?: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type MonthlyInvoiceLine = {
  requestNo: string
  partyName: string
  date: string
  articlesHm: number
  amount: number
}

export type MonthlyInvoice = {
  id: string
  invoiceNo: string
  partyId: string
  partyName: string
  partyGstin: string
  partyCml: string
  placeOfSupply: string
  stateCode: string
  date: string
  invoiceDateTime: string
  period: string
  sac: string
  requestNos: string[]
  lines: MonthlyInvoiceLine[]
  amount: number
  cgst: number
  sgst: number
  igst: number
  tax: number
  total: number
  useIgst: boolean
  status: 'Unpaid' | 'Paid' | 'Partial'
  updatedAt?: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type FundEntry = {
  id: string
  date: string
  source: string
  amount: number
  mode: 'Cash' | 'UPI' | 'Bank' | 'Cheque'
  remarks: string
  voucherNo?: string
  partyId?: string
  partyName?: string
  chequeNo?: string
  bankName?: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type ExpenseEntry = {
  id: string
  date: string
  category: string
  amount: number
  paidTo: string
  remarks: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type FireAssay = {
  id: string
  assayNo: string
  requestNo: string
  partyName: string
  sampleWeight: number
  purityFound: number
  declaredPurity: string
  status: 'In Lab' | 'Completed'
  date: string
  analyst: string
  assayType:
    | 'Cg Auto'
    | 'Cornet Auto'
    | 'Cornet MS M2'
    | 'Manual'
}

export type StockItem = {
  id: string
  name: string
  unit: string
  quantity: number
  minLevel: number
  location: 'QM' | 'Lab'
}

export type TouchRecord = {
  id: string
  touchNo: string
  partyName: string
  metal: string
  declaredTouch: string
  foundTouch: string
  weight: number
  date: string
  amount: number
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type XrayEntry = {
  id: string
  sheetNo: string
  requestNo: string
  partyName: string
  reading: number
  purity: string
  date: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type PendingRoughRequest = {
  id: string
  partyId: string
  partyName: string
  item: string
  pic: number
  weight: number
  purity: string
  requestNo: string
  receiptNo: string
  jobCardNo: string
  cml: string
  night: string
  date: string
  status: 'Pending' | 'Saved'
  ahcFileName?: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

type StoreShape = {
  parties: Party[]
  categories: Category[]
  /** Jewellery type names for New Category / Manual Request */
  jewelleryCategories: JewelleryCategory[]
  requests: HallmarkRequest[]
  roughSheets: RoughSheetEntry[]
  pendingRough: PendingRoughRequest[]
  invoices: Invoice[]
  monthlyInvoices: MonthlyInvoice[]
  funds: FundEntry[]
  expenses: ExpenseEntry[]
  fireAssays: FireAssay[]
  stock: StockItem[]
  touches: TouchRecord[]
  xray: XrayEntry[]
}

function emptyStore(): StoreShape {
  return {
    parties: [],
    categories: [],
    jewelleryCategories: [],
    requests: [],
    roughSheets: [],
    pendingRough: [],
    invoices: [],
    monthlyInvoices: [],
    funds: [],
    expenses: [],
    fireAssays: [],
    stock: [],
    touches: [],
    xray: [],
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function nowIso() {
  return new Date().toISOString()
}

function sessionCentreStamp(forRequest = false): {
  centreId: string
  centreKind: 'main' | 'osc'
  oscTransferStatus?: OscTransferStatus
} {
  const s = getSession()
  const centreId = s?.centreId || 'main'
  const centreKind = s?.centreKind === 'osc' ? 'osc' : 'main'
  return {
    centreId,
    centreKind,
    ...(forRequest && centreKind === 'osc' ? { oscTransferStatus: 'pending_local' as const } : {}),
  }
}

export function oscTransferLabel(status?: OscTransferStatus | null) {
  switch (status) {
    case 'pending_local':
      return 'OSC local'
    case 'sent_to_main':
      return 'Sent to Main'
    case 'assay_in_lab':
      return 'In Main Lab'
    case 'returned_to_osc':
      return 'Returned to OSC'
    default:
      return ''
  }
}

/** Active OSC outlet id when logged into an Off-Site centre. */
export function oscDataScopeId(): string | null {
  const s = getSession()
  if (s?.centreKind !== 'osc') return null
  return s.centreId || null
}

/** True when row belongs to an Off-Site outlet (not Main). */
function isOscRecord(meta?: { centreId?: string; centreKind?: 'main' | 'osc' } | null) {
  if (!meta) return false
  if (meta.centreKind === 'osc') return true
  if (meta.centreId && meta.centreId !== 'main') return true
  return false
}

function matchesCentreScope(
  scopeId: string,
  meta?: { centreId?: string; centreKind?: 'main' | 'osc' } | null,
) {
  if (!meta) return false
  if (meta.centreId) return meta.centreId === scopeId
  if (meta.centreKind === 'osc') {
    const s = getSession()
    return s?.centreKind === 'osc' && (s.centreId || 'main') === scopeId
  }
  return false
}

function matchesMainScope(meta?: { centreId?: string; centreKind?: 'main' | 'osc' } | null) {
  // Untagged legacy rows count as Main; OSC-tagged rows stay on OSC only
  return !isOscRecord(meta)
}

/**
 * Centre-scoped store for UI:
 * - OSC login → only that outlet
 * - Main login → Main only (OSC funds/bills/parties do not mix)
 * Lab still uses getAllRaw() for OSC sample assay queue.
 */
function scopeStoreForSession(data: StoreShape): StoreShape {
  const session = getSession()
  const oscId = oscDataScopeId()

  const filterMoneyAndParties = (
    match: (meta?: { centreId?: string; centreKind?: 'main' | 'osc' } | null) => boolean,
    requestMatch: (r: HallmarkRequest) => boolean,
  ) => {
    const requests = data.requests.filter(requestMatch)
    const requestNos = new Set(requests.map((r) => r.requestNo))

    const roughSheets = data.roughSheets.filter((r) => {
      if (match(r)) return true
      if (r.requestNo && requestNos.has(r.requestNo)) return true
      if (r.requestNo) {
        const req = findRequestByNo(data, r.requestNo)
        return req ? requestMatch(req) : false
      }
      return false
    })

    const parties = data.parties.filter((p) => match(p))
    const pendingRough = data.pendingRough.filter((r) => {
      if (match(r)) return true
      const party = data.parties.find((p) => p.id === r.partyId)
      return match(party)
    })

    const invoices = data.invoices.filter((inv) => {
      if (match(inv)) return true
      if (inv.requestNo && requestNos.has(inv.requestNo)) return true
      if (inv.requestNo) {
        const req = findRequestByNo(data, inv.requestNo)
        return req ? requestMatch(req) : false
      }
      if (inv.partyId) {
        const party = data.parties.find((p) => p.id === inv.partyId)
        return match(party)
      }
      return false
    })

    const monthlyInvoices = (data.monthlyInvoices || []).filter((inv) => {
      if (match(inv)) return true
      if (inv.partyId) {
        const party = data.parties.find((p) => p.id === inv.partyId)
        return match(party)
      }
      return (inv.requestNos || []).some((no) => requestNos.has(no))
    })

    // Funds: strict centre tag only — never inherit via party (avoids OSC↔Main mix)
    const funds = data.funds.filter((f) => match(f))
    const expenses = data.expenses.filter((e) => match(e))
    const touches = data.touches.filter((t) => match(t))
    const xray = data.xray.filter((x) => {
      if (match(x)) return true
      if (x.requestNo && requestNos.has(x.requestNo)) return true
      return false
    })
    const fireAssays = data.fireAssays.filter(
      (fa) => fa.requestNo && requestNos.has(fa.requestNo),
    )
    const jewelleryCategories = data.jewelleryCategories

    return {
      ...data,
      parties,
      requests,
      roughSheets,
      pendingRough,
      invoices,
      monthlyInvoices,
      funds,
      expenses,
      touches,
      xray,
      fireAssays,
      jewelleryCategories,
    }
  }

  if (oscId) {
    return filterMoneyAndParties(
      (meta) => matchesCentreScope(oscId, meta),
      (r) => matchesCentreScope(oscId, r),
    )
  }

  // Main / QM / admin desk — exclude OSC outlet operational data
  if (!session || session.centreKind !== 'osc') {
    return filterMoneyAndParties(matchesMainScope, (r) => matchesMainScope(r))
  }

  return data
}

/** Normalize 22K916 / 916 / 22k → category purity code */
export function normalizePurityCode(raw: string): string {
  const s = String(raw || '')
  if (/925|silver/i.test(s)) return '925'
  if (/999|24\s*k/i.test(s)) return '999'
  if (/750|18\s*k/i.test(s)) return '750'
  if (/585|14\s*k/i.test(s)) return '585'
  if (/916|22\s*k/i.test(s)) return '916'
  const all = s.match(/\d{3}/g)
  return all?.[all.length - 1] || '916'
}

function findCategory(data: StoreShape, purityRaw: string) {
  const code = normalizePurityCode(purityRaw)
  return (
    data.categories.find((c) => normalizePurityCode(c.purity) === code) ??
    data.categories.find((c) => c.purity === code) ??
    data.categories[0]
  )
}

function findRequestByNo(data: StoreShape, requestNo: string) {
  if (!requestNo) return undefined
  return data.requests.find((r) => r.requestNo === requestNo)
}

function seed(): StoreShape {
  const parties: Party[] = [
    {
      id: 'p1',
      name: 'Rajesh Jewellers',
      phone: '9876543210',
      address: 'MG Road, City',
      gstin: '27AAAAA0000A1Z5',
      createdAt: today(),
      transactionType: 'Cash',
      licenseNo: 'LIC-1001',
      state: 'Maharashtra',
      stateCode: '27',
      groupName: '',
      skipMinBill: false,
      skipRejectedPics: true,
      skipCutting: true,
      igstApplicable: false,
      discount: 0,
      minBillCalc: false,
    },
    {
      id: 'p2',
      name: 'Shree Gold Palace',
      phone: '9123456780',
      address: 'Market Yard',
      gstin: '27BBBBB0000B1Z5',
      createdAt: today(),
      transactionType: 'Credit',
      licenseNo: 'LIC-1002',
      state: 'Maharashtra',
      stateCode: '27',
      groupName: '',
      skipMinBill: false,
      skipRejectedPics: false,
      skipCutting: false,
      igstApplicable: false,
      discount: 0,
      minBillCalc: false,
    },
    {
      id: 'p3',
      name: 'Mehta Ornaments',
      phone: '9988776655',
      address: 'Station Road',
      gstin: '',
      createdAt: today(),
      transactionType: 'Cash',
      licenseNo: 'LIC-1003',
      state: 'Gujarat',
      stateCode: '24',
      groupName: '',
      skipMinBill: true,
      skipRejectedPics: true,
      skipCutting: false,
      igstApplicable: false,
      discount: 0,
      minBillCalc: false,
    },
  ]

  const categories: Category[] = [
    { id: 'c1', name: '22K Jewellery', purity: '916', metal: 'Gold', rate: 45 },
    { id: 'c2', name: '18K Jewellery', purity: '750', metal: 'Gold', rate: 40 },
    { id: 'c3', name: 'Silver Articles', purity: '925', metal: 'Silver', rate: 15 },
    { id: 'c4', name: '14K Jewellery', purity: '585', metal: 'Gold', rate: 35 },
  ]

  const requests: HallmarkRequest[] = [
    {
      id: 'r1',
      requestNo: 'HM-2026-001',
      partyId: 'p1',
      partyName: 'Rajesh Jewellers',
      categoryId: 'c1',
      categoryName: '22K Jewellery',
      pieces: 24,
      weight: 86.42,
      purity: '916',
      status: 'In Progress',
      source: 'Manual',
      date: today(),
      remarks: 'Urgent delivery',
    },
    {
      id: 'r2',
      requestNo: 'HM-2026-002',
      partyId: 'p2',
      partyName: 'Shree Gold Palace',
      categoryId: 'c2',
      categoryName: '18K Jewellery',
      pieces: 12,
      weight: 42.1,
      purity: '750',
      status: 'Pending',
      source: 'Auto',
      date: today(),
      remarks: '',
    },
    {
      id: 'r3',
      requestNo: 'HM-2026-003',
      partyId: 'p3',
      partyName: 'Mehta Ornaments',
      categoryId: 'c3',
      categoryName: 'Silver Articles',
      pieces: 40,
      weight: 210.5,
      purity: '925',
      status: 'Assayed',
      source: 'Manual',
      date: today(),
      remarks: 'Chain lot',
    },
  ]

  return {
    parties,
    categories,
    jewelleryCategories: [] as JewelleryCategory[],
    requests,
    roughSheets: [
      {
        id: 'rs1',
        partyId: 'p1',
        partyName: 'Rajesh Jewellers',
        item: 'Necklace Set',
        pic: 12,
        weight: 48.25,
        purity: '916',
        sampleWeight: 0.8,
        sampleQty: 1,
        samplingMethod: 'Drill',
        cml: 'CML-77821',
        status: 'Pending',
        shift: 'Day',
        date: today(),
        address: 'MG Road, City',
        requestNo: 'RQ-260721-01',
      },
      {
        id: 'rs2',
        partyId: 'p1',
        partyName: 'Rajesh Jewellers',
        item: 'Bangles',
        pic: 8,
        weight: 62.1,
        purity: '916',
        sampleWeight: 0.5,
        sampleQty: 1,
        samplingMethod: 'Cut',
        cml: 'CML-77822',
        status: 'Pending',
        shift: 'Day',
        date: today(),
        address: 'MG Road, City',
        requestNo: 'RQ-260721-02',
      },
      {
        id: 'rs3',
        partyId: 'p2',
        partyName: 'Shree Gold Palace',
        item: 'Earrings',
        pic: 20,
        weight: 28.4,
        purity: '750',
        sampleWeight: 0.4,
        sampleQty: 2,
        samplingMethod: 'Drill',
        cml: 'CML-77830',
        status: 'Pending',
        shift: 'Night',
        date: today(),
        address: 'Market Yard',
        requestNo: 'RQ-260721-03',
      },
      {
        id: 'rs4',
        partyId: 'p3',
        partyName: 'Mehta Ornaments',
        item: 'Silver Chain',
        pic: 15,
        weight: 95.6,
        purity: '925',
        sampleWeight: 1.0,
        sampleQty: 1,
        samplingMethod: 'Scrap',
        cml: 'CML-77840',
        status: 'Pending',
        shift: 'Day',
        date: today(),
        address: 'Station Road',
        requestNo: 'RQ-260721-04',
      },
    ],
    pendingRough: [
      {
        id: 'pr1',
        partyId: 'p1',
        partyName: 'Rajesh Jewellers',
        item: 'Necklace Set',
        pic: 12,
        weight: 48.25,
        purity: '916',
        requestNo: 'RQ-260721-01',
        receiptNo: 'RC-1001',
        jobCardNo: 'JC-4501',
        cml: 'CML-77821',
        night: 'Day',
        date: today(),
        status: 'Pending',
      },
      {
        id: 'pr2',
        partyId: 'p1',
        partyName: 'Rajesh Jewellers',
        item: 'Bangles',
        pic: 8,
        weight: 62.1,
        purity: '916',
        requestNo: 'RQ-260721-02',
        receiptNo: 'RC-1002',
        jobCardNo: 'JC-4502',
        cml: 'CML-77822',
        night: 'Day',
        date: today(),
        status: 'Pending',
      },
      {
        id: 'pr3',
        partyId: 'p2',
        partyName: 'Shree Gold Palace',
        item: 'Earrings',
        pic: 20,
        weight: 28.4,
        purity: '750',
        requestNo: 'RQ-260721-03',
        receiptNo: 'RC-1003',
        jobCardNo: 'JC-4503',
        cml: 'CML-77830',
        night: 'Night',
        date: today(),
        status: 'Pending',
      },
      {
        id: 'pr4',
        partyId: 'p3',
        partyName: 'Mehta Ornaments',
        item: 'Silver Chain',
        pic: 15,
        weight: 95.6,
        purity: '925',
        requestNo: 'RQ-260721-04',
        receiptNo: 'RC-1004',
        jobCardNo: 'JC-4504',
        cml: 'CML-77840',
        night: 'Day',
        date: today(),
        status: 'Pending',
      },
    ],
    invoices: [
      {
        id: 'inv1',
        invoiceNo: 'INV-2026-001',
        partyName: 'Rajesh Jewellers',
        requestNo: 'HM-2026-001',
        amount: 1080,
        tax: 194.4,
        total: 1274.4,
        status: 'Unpaid',
        date: today(),
      },
    ],
    monthlyInvoices: [],
    funds: [
      {
        id: 'f1',
        date: today(),
        source: 'Counter collection',
        amount: 15000,
        mode: 'Cash',
        remarks: 'Opening float',
        voucherNo: '1',
        partyName: 'Counter collection',
        chequeNo: '',
        bankName: '',
      },
    ],
    expenses: [
      {
        id: 'e1',
        date: today(),
        category: 'Chemicals',
        amount: 2500,
        paidTo: 'Lab Supplies Co.',
        remarks: 'Nitric acid restock',
      },
    ],
    fireAssays: [
      {
        id: 'fa1',
        assayNo: 'FA-2026-001',
        requestNo: 'HM-2026-003',
        partyName: 'Mehta Ornaments',
        sampleWeight: 0.25,
        purityFound: 924.5,
        declaredPurity: '925',
        status: 'Completed',
        date: today(),
        analyst: 'Lab Tech 1',
        assayType: 'Manual',
      },
    ],
    stock: [
      { id: 's1', name: 'Hallmark Tags', unit: 'pcs', quantity: 1200, minLevel: 300, location: 'QM' },
      { id: 's2', name: 'Job Card Sheets', unit: 'pcs', quantity: 450, minLevel: 100, location: 'QM' },
      { id: 's3', name: 'Cupels', unit: 'pcs', quantity: 80, minLevel: 50, location: 'Lab' },
      { id: 's4', name: 'Lead Foil', unit: 'kg', quantity: 4.5, minLevel: 2, location: 'Lab' },
      { id: 's5', name: 'Nitric Acid', unit: 'ltr', quantity: 8, minLevel: 3, location: 'Lab' },
    ],
    touches: [
      {
        id: 't1',
        touchNo: 'TH-2026-001',
        partyName: 'Rajesh Jewellers',
        metal: 'Gold',
        declaredTouch: '22K',
        foundTouch: '21.8K',
        weight: 12.4,
        date: today(),
        amount: 200,
      },
    ],
    xray: [
      {
        id: 'x1',
        sheetNo: 'XRF-2026-001',
        requestNo: 'HM-2026-001',
        partyName: 'Rajesh Jewellers',
        reading: 916.2,
        purity: '916',
        date: today(),
      },
    ],
  }
}

function normalizeRough(r: Partial<RoughSheetEntry> & { id: string }): RoughSheetEntry {
  return {
    id: r.id,
    partyId: r.partyId ?? '',
    partyName: r.partyName ?? '',
    item: r.item ?? '',
    pic: r.pic ?? (r as { pieces?: number }).pieces ?? 0,
    weight: r.weight ?? (r as { roughWeight?: number }).roughWeight ?? 0,
    purity: r.purity ?? '',
    sampleWeight: r.sampleWeight ?? 0,
    sampleQty: r.sampleQty ?? 1,
    samplingMethod: r.samplingMethod ?? 'Drill',
    cml: r.cml ?? '',
    status: r.status ?? 'Pending',
    shift: r.shift ?? 'Day',
    date: r.date ?? today(),
    address: r.address ?? '',
    requestNo: r.requestNo,
    jobCardNo: r.jobCardNo ?? '',
    jobCardSaved: Boolean(r.jobCardSaved),
    co: r.co ?? '',
    sampleTagId: r.sampleTagId ?? '',
    cornet: r.cornet,
    rejectPic: r.rejectPic ?? 0,
    centreId: r.centreId,
    centreKind: r.centreKind === 'osc' ? 'osc' : r.centreKind === 'main' ? 'main' : undefined,
  }
}

function normalizeParty(p: Partial<Party> & { id: string; name: string }): Party {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone ?? '',
    address: p.address ?? '',
    gstin: p.gstin ?? '',
    createdAt: p.createdAt ?? today(),
    transactionType: p.transactionType ?? 'Cash',
    licenseNo: p.licenseNo ?? '',
    state: p.state ?? '',
    stateCode: p.stateCode ?? '',
    groupName: p.groupName ?? '',
    skipMinBill: p.skipMinBill ?? false,
    skipRejectedPics: p.skipRejectedPics ?? false,
    skipCutting: p.skipCutting ?? false,
    igstApplicable: p.igstApplicable ?? false,
    discount: Number(p.discount) || 0,
    minBillCalc: p.minBillCalc ?? false,
    centreId: p.centreId,
    centreKind: p.centreKind === 'osc' ? 'osc' : p.centreKind === 'main' ? 'main' : undefined,
  }
}

function normalizeLoaded(parsed: StoreShape): StoreShape {
  if (!parsed.pendingRough) parsed.pendingRough = []
  if (!parsed.monthlyInvoices) parsed.monthlyInvoices = []
  if (!parsed.jewelleryCategories) parsed.jewelleryCategories = []
  parsed.parties = (parsed.parties ?? []).map((p) => normalizeParty(p))
  parsed.jewelleryCategories = (parsed.jewelleryCategories ?? [])
    .filter((c) => c && String(c.name || '').trim())
    .map((c) => ({
      id: c.id || uid('jc'),
      name: String(c.name).trim(),
    }))
  parsed.fireAssays = (parsed.fireAssays ?? []).map((a) => ({
    ...a,
    assayType: a.assayType ?? 'Manual',
  }))
  const rawRough = parsed.roughSheets ?? []
  const looksLegacy = rawRough.some(
    (r) => 'roughWeight' in r && !('sampleWeight' in r),
  )
  parsed.roughSheets = looksLegacy ? [] : rawRough.map((r) => normalizeRough(r))
  if (!parsed.categories?.length) {
    parsed.categories = seed().categories
  }
  return parsed
}

function load(): StoreShape {
  const tid = getActiveTenantId()
  if (!tid || tid === '__none__') {
    return emptyStore()
  }
  const cached = getStoreCache<StoreShape>()
  if (cached) {
    return normalizeLoaded(cached)
  }
  // Not hydrated yet — empty until API hydrate completes
  const data = emptyStore()
  data.categories = seed().categories
  return data
}

function save(data: StoreShape) {
  setStoreCache(data)
}

function normPartyName(name: string | undefined | null) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function fundBelongsToParty(f: FundEntry, partyName: string) {
  const key = normPartyName(partyName)
  if (!key) return false
  return normPartyName(f.partyName) === key || normPartyName(f.source) === key
}

/**
 * Allocate party funds FIFO (oldest invoice first) → Paid / Partial / Unpaid.
 * Returns a map of invoiceId → status (does not mutate).
 */
export function computeInvoicePaymentStatuses(
  invoices: Invoice[],
  funds: FundEntry[],
  partyName?: string,
): Map<string, Invoice['status']> {
  const result = new Map<string, Invoice['status']>()
  const partyKey = partyName ? normPartyName(partyName) : null

  const byParty = new Map<string, Invoice[]>()
  for (const inv of invoices) {
    const k = normPartyName(inv.partyName)
    if (!k) continue
    if (partyKey && k !== partyKey) continue
    if (!byParty.has(k)) byParty.set(k, [])
    byParty.get(k)!.push(inv)
  }

  for (const [k, invs] of byParty) {
    let pool = funds
      .filter((f) => fundBelongsToParty(f, k))
      .reduce((s, f) => s + (Number(f.amount) || 0), 0)

    const sorted = [...invs].sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''))
      if (d !== 0) return d
      return String(a.invoiceNo || '').localeCompare(String(b.invoiceNo || ''))
    })

    for (const inv of sorted) {
      const total = Number(inv.total) || 0
      if (pool <= 0.009) {
        result.set(inv.id, 'Unpaid')
      } else if (pool + 0.009 >= total) {
        result.set(inv.id, 'Paid')
        pool = Number((pool - total).toFixed(2))
      } else {
        result.set(inv.id, 'Partial')
        pool = 0
      }
    }
  }
  return result
}

/** Persist Paid/Partial/Unpaid from Fund Entry totals (FIFO). */
function applyInvoicePaymentStatuses(data: StoreShape, partyName?: string) {
  const statuses = computeInvoicePaymentStatuses(data.invoices, data.funds, partyName)
  let changed = false
  const now = new Date().toISOString()
  for (const inv of data.invoices) {
    const next = statuses.get(inv.id)
    if (!next || inv.status === next) continue
    inv.status = next
    inv.updatedAt = now
    changed = true
  }
  return changed
}

/** Party outstanding: billed − paid (negative = advance / credit). */
export function calcPartyBalance(
  invoices: Invoice[],
  funds: FundEntry[],
  partyName: string,
  excludeVoucherNo?: string,
) {
  const billed = invoices
    .filter((i) => normPartyName(i.partyName) === normPartyName(partyName))
    .reduce((s, i) => s + (Number(i.total) || 0), 0)
  const paid = funds
    .filter((f) => fundBelongsToParty(f, partyName))
    .filter((f) => !excludeVoucherNo || String(f.voucherNo) !== String(excludeVoucherNo))
    .reduce((s, f) => s + (Number(f.amount) || 0), 0)
  return Number((billed - paid).toFixed(2))
}

export const store = {
  /** UI lists — OSC sessions are centre-scoped; Main sees full firm data */
  getAll: () => scopeStoreForSession(load()),

  /** Unscoped — mutations / Main lab handoff */
  getAllRaw: () => load(),

  /** Recompute invoice Paid/Partial/Unpaid from funds (optional party filter). */
  syncInvoicePaymentStatuses(partyName?: string) {
    const data = load()
    if (!applyInvoicePaymentStatuses(data, partyName)) return 0
    save(data)
    return 1
  },

  addParty(input: Omit<Party, 'id' | 'createdAt'>) {
    const data = load()
    const stamp = sessionCentreStamp()
    const party: Party = {
      ...input,
      ...stamp,
      id: uid('p'),
      createdAt: today(),
      discount: Number(input.discount) || 0,
      minBillCalc: Boolean(input.minBillCalc),
      centreId: stamp.centreId,
      centreKind: stamp.centreKind,
    }
    data.parties.unshift(party)
    save(data)
    return party
  },

  updateParty(id: string, patch: Partial<Omit<Party, 'id' | 'createdAt'>>) {
    const data = load()
    const party = data.parties.find((p) => p.id === id)
    if (!party) return null
    Object.assign(party, patch)
    if (patch.discount !== undefined) party.discount = Number(patch.discount) || 0
    save(data)
    return party
  },

  deleteParty(id: string) {
    const data = load()
    const before = data.parties.length
    data.parties = data.parties.filter((p) => p.id !== id)
    if (data.parties.length === before) return false
    save(data)
    return true
  },

  updatePartyGroup(partyId: string, groupName: string) {
    const data = load()
    const party = data.parties.find((p) => p.id === partyId)
    if (!party) return
    party.groupName = groupName
    save(data)
  },

  addCategory(input: Omit<Category, 'id'>) {
    const data = load()
    const category: Category = { ...input, id: uid('c') }
    data.categories.unshift(category)
    save(data)
    return category
  },

  addJewelleryCategory(name: string) {
    const data = load()
    const trimmed = name.trim()
    if (!trimmed) return null
    const exists = data.jewelleryCategories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (exists) return null
    const row: JewelleryCategory = { id: uid('jc'), name: trimmed }
    data.jewelleryCategories.unshift(row)
    save(data)
    return row
  },

  updateJewelleryCategory(id: string, name: string) {
    const data = load()
    const row = data.jewelleryCategories.find((c) => c.id === id)
    if (!row) return null
    const trimmed = name.trim()
    if (!trimmed) return null
    const clash = data.jewelleryCategories.some(
      (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (clash) return null
    row.name = trimmed
    save(data)
    return row
  },

  deleteJewelleryCategory(id: string) {
    const data = load()
    const before = data.jewelleryCategories.length
    data.jewelleryCategories = data.jewelleryCategories.filter((c) => c.id !== id)
    if (data.jewelleryCategories.length === before) return false
    save(data)
    return true
  },

  /** GoldShark “Sync from Database” — common jewellery types */
  syncJewelleryCategoriesFromDefaults() {
    const defaults = [
      'Necklace',
      'Bangles',
      'Earrings',
      'Ring',
      'Chain',
      'Pendant',
      'Bracelet',
      'Jhumka',
      'Tops',
      'Locket',
      'Mangalsutra',
      'Coin',
      'Kan Tana',
      'Jitiya',
      'Other',
    ]
    const data = load()
    let added = 0
    const existing = new Set(data.jewelleryCategories.map((c) => c.name.toLowerCase()))
    for (const name of defaults) {
      if (existing.has(name.toLowerCase())) continue
      data.jewelleryCategories.push({ id: uid('jc'), name })
      existing.add(name.toLowerCase())
      added += 1
    }
    if (added > 0) save(data)
    return added
  },

  addRequest(input: Omit<HallmarkRequest, 'id' | 'requestNo' | 'date'>) {
    const data = load()
    const n = data.requests.length + 1
    const req: HallmarkRequest = {
      ...sessionCentreStamp(true),
      ...input,
      id: uid('r'),
      requestNo: `HM-2026-${String(n).padStart(3, '0')}`,
      date: today(),
    }
    data.requests.unshift(req)
    save(data)
    return req
  },

  updateRequestStatus(id: string, status: HallmarkRequest['status']) {
    const data = load()
    const item = data.requests.find((r) => r.id === id)
    if (!item) return
    item.status = status
    // Mirror day-sheet rough lines (Gold Shark QM ↔ Request List)
    if (item.requestNo) {
      for (const rough of data.roughSheets) {
        if (rough.requestNo !== item.requestNo) continue
        if (status === 'Hallmarked' && rough.status !== 'Rejected') rough.status = 'Completed'
        else if (status === 'In Progress' && rough.status === 'Pending') rough.status = 'Accepted'
        else if (status === 'Assayed' && (rough.status === 'Accepted' || rough.status === 'Pending')) {
          rough.status = 'Accepted'
        }
      }
    }
    save(data)
  },

  /**
   * OSC desk: after sampling, send sample to Main Centre for fire assay.
   * `roughIds` = Request List / QM list row ids.
   */
  sendRoughSamplesToMain(roughIds: string[]): { sent: number; error?: string } {
    const data = load()
    const session = getSession()
    if (session?.centreKind !== 'osc') {
      return { sent: 0, error: 'Only Off-Site Centre can send samples to Main' }
    }
    let sent = 0
    const errors: string[] = []
    for (const rid of roughIds) {
      const rough = data.roughSheets.find((r) => r.id === rid)
      if (!rough?.requestNo) {
        errors.push('Row missing request no')
        continue
      }
      if (!(rough.jobCardNo || '').trim() || !rough.jobCardSaved) {
        errors.push(`${rough.requestNo}: Save Job Card first`)
        continue
      }
      if (!(Number(rough.sampleWeight) > 0)) {
        errors.push(`${rough.requestNo}: Enter sample weight before send`)
        continue
      }
      const req = findRequestByNo(data, rough.requestNo)
      if (!req) {
        errors.push(`${rough.requestNo}: Request not found`)
        continue
      }
      if (req.centreKind !== 'osc' && req.oscTransferStatus == null) {
        // Stamp as OSC if created before centre feature
        req.centreKind = 'osc'
        req.centreId = session.centreId || req.centreId || 'osc'
      }
      if (req.centreKind !== 'osc') {
        errors.push(`${req.requestNo}: Not an OSC job`)
        continue
      }
      if (req.oscTransferStatus === 'sent_to_main' || req.oscTransferStatus === 'assay_in_lab') {
        errors.push(`${req.requestNo}: Already at Main`)
        continue
      }
      if (req.oscTransferStatus === 'returned_to_osc' || req.status === 'Assayed') {
        errors.push(`${req.requestNo}: Assay already returned`)
        continue
      }
      if (req.status === 'Billed' || req.status === 'Delivered' || req.status === 'Hallmarked') {
        errors.push(`${req.requestNo}: Already closed`)
        continue
      }
      req.oscTransferStatus = 'sent_to_main'
      req.sentToMainAt = nowIso()
      if (req.status === 'Pending') req.status = 'In Progress'
      sent += 1
    }
    if (sent > 0) save(data)
    return { sent, error: sent === 0 ? errors[0] || 'Nothing sent' : undefined }
  },

  /** Main lab: mark OSC samples as in-lab when loaded on fire assay sheet */
  markOscAssayInLab(requestIds: string[]) {
    const data = load()
    let n = 0
    for (const id of requestIds) {
      const req = data.requests.find((r) => r.id === id)
      if (!req) continue
      if (req.centreKind !== 'osc' && !req.oscTransferStatus) continue
      if (req.oscTransferStatus === 'sent_to_main' || req.oscTransferStatus === 'pending_local') {
        req.oscTransferStatus = 'assay_in_lab'
        n += 1
      }
    }
    if (n > 0) save(data)
    return n
  },

  /**
   * Main lab: after fire assay sheet created — Assayed + return sample result to OSC.
   */
  markOscAssayReturned(requestIdsOrNos: string[]) {
    const data = load()
    let n = 0
    for (const key of requestIdsOrNos) {
      const req =
        data.requests.find((r) => r.id === key) ||
        data.requests.find((r) => r.requestNo === key)
      if (!req) continue
      req.status = 'Assayed'
      if (req.centreKind === 'osc' || req.oscTransferStatus) {
        req.centreKind = req.centreKind || 'osc'
        req.oscTransferStatus = 'returned_to_osc'
        req.returnedToOscAt = nowIso()
      }
      if (req.requestNo) {
        for (const rough of data.roughSheets) {
          if (rough.requestNo === req.requestNo && rough.status !== 'Rejected') {
            rough.status = 'Accepted'
          }
        }
      }
      n += 1
    }
    if (n > 0) save(data)
    return n
  },

  /** Whether laser Complete is allowed for this rough row */
  canCompleteOscLaser(roughId: string): { ok: boolean; reason?: string } {
    const data = load()
    const rough = data.roughSheets.find((r) => r.id === roughId)
    if (!rough?.requestNo) return { ok: true }
    const req = findRequestByNo(data, rough.requestNo)
    if (!req) return { ok: true }
    const isOsc = req.centreKind === 'osc' || Boolean(req.oscTransferStatus)
    if (!isOsc) return { ok: true }
    const session = getSession()
    if (session?.centreKind !== 'osc') {
      return { ok: false, reason: `${req.requestNo}: Laser marking is at Off-Site Centre` }
    }
    if (
      req.oscTransferStatus === 'sent_to_main' ||
      req.oscTransferStatus === 'assay_in_lab' ||
      req.oscTransferStatus === 'pending_local'
    ) {
      return {
        ok: false,
        reason: `${req.requestNo}: Wait for Main fire assay (status: ${oscTransferLabel(req.oscTransferStatus)})`,
      }
    }
    if (req.oscTransferStatus === 'returned_to_osc' || req.status === 'Assayed') {
      return { ok: true }
    }
    return { ok: false, reason: `${req.requestNo}: Assay not returned yet` }
  },

  getRequestByNo(requestNo: string) {
    const req = findRequestByNo(load(), requestNo)
    if (!req) return undefined
    const scopeId = oscDataScopeId()
    if (scopeId && !matchesCentreScope(scopeId, req)) return undefined
    return req
  },

  addRoughSheet(input: Omit<RoughSheetEntry, 'id' | 'date' | 'status'> & { status?: RoughSheetEntry['status'] }) {
    const data = load()
    const entry: RoughSheetEntry = {
      ...sessionCentreStamp(),
      ...input,
      id: uid('rs'),
      date: today(),
      status: input.status ?? 'Pending',
    }
    data.roughSheets.unshift(entry)
    save(data)
    return entry
  },

  updateRoughSheetRow(
    id: string,
    patch: Partial<
      Pick<
        RoughSheetEntry,
        | 'sampleWeight'
        | 'sampleQty'
        | 'samplingMethod'
        | 'weight'
        | 'jobCardNo'
        | 'jobCardSaved'
        | 'co'
        | 'sampleTagId'
        | 'cornet'
        | 'rejectPic'
        | 'status'
        | 'pic'
      >
    >,
  ) {
    const data = load()
    const row = data.roughSheets.find((r) => r.id === id)
    if (!row) return
    Object.assign(row, patch)
    // Keep HallmarkRequest job card in sync when saved
    if (patch.jobCardNo !== undefined && row.requestNo) {
      const req = findRequestByNo(data, row.requestNo)
      if (req) req.jobCardNo = patch.jobCardNo
    }
    save(data)
  },

  updateRoughSheetStatus(ids: string[], status: RoughSheetEntry['status']) {
    const data = load()
    let count = 0
    for (const id of ids) {
      const row = data.roughSheets.find((r) => r.id === id)
      if (!row) continue
      row.status = status
      count += 1

      // Keep HallmarkRequest in sync (Gold Shark day sheet → billable)
      if (row.requestNo) {
        const req = findRequestByNo(data, row.requestNo)
        if (req && req.status !== 'Billed' && req.status !== 'Delivered') {
          if (status === 'Completed') req.status = 'Hallmarked'
          else if (status === 'Accepted' && (req.status === 'Pending' || req.status === 'In Progress')) {
            req.status = 'In Progress'
          } else if (status === 'Rejected' && req.status !== 'Hallmarked') {
            req.status = 'Pending'
          }
        }
      }
    }
    save(data)
    return count
  },

  getRoughSheetRows(filters?: { partyId?: string; shift?: string; date?: string }) {
    return load().roughSheets.filter((r) => {
      if (r.status !== 'Pending') return false
      if (filters?.partyId && r.partyId !== filters.partyId) return false
      if (filters?.shift && r.shift !== filters.shift) return false
      if (filters?.date && r.date !== filters.date) return false
      return true
    })
  },

  acceptRoughSheets(ids: string[]) {
    const data = load()
    const accepted: RoughSheetEntry[] = []
    for (const id of ids) {
      const row = data.roughSheets.find((r) => r.id === id && r.status === 'Pending')
      if (!row) continue
      row.weight = Number((row.weight + row.sampleWeight).toFixed(3))
      row.status = 'Accepted'
      row.purity = normalizePurityCode(row.purity)
      accepted.push(row)

      const category = findCategory(data, row.purity)
      const requestNo =
        row.requestNo || `HM-2026-${String(data.requests.length + 1).padStart(3, '0')}`
      row.requestNo = requestNo

      const existing = findRequestByNo(data, requestNo)
      if (existing) {
        existing.status = 'In Progress'
        existing.pieces = row.pic
        existing.weight = row.weight
        existing.purity = row.purity
        existing.item = row.item
        existing.jobCardNo = row.jobCardNo || existing.jobCardNo
        existing.remarks = `Rough accepted · Sample ${row.sampleWeight}g · ${row.samplingMethod}`
      } else {
        data.requests.unshift({
          id: uid('r'),
          requestNo,
          partyId: row.partyId,
          partyName: row.partyName,
          categoryId: category?.id || '',
          categoryName: category?.name || 'Gold Jewellery',
          pieces: row.pic,
          weight: row.weight,
          purity: row.purity,
          status: 'In Progress',
          source: 'Manual',
          date: row.date,
          remarks: `Rough accepted · Sample ${row.sampleWeight}g · ${row.samplingMethod}`,
          item: row.item,
          jobCardNo: row.jobCardNo,
        })
      }
    }
    save(data)
    return accepted
  },

  rejectRoughSheets(ids: string[]) {
    const data = load()
    let count = 0
    for (const id of ids) {
      const row = data.roughSheets.find((r) => r.id === id && r.status === 'Pending')
      if (!row) continue
      row.status = 'Rejected'
      count += 1
      if (row.requestNo) {
        const req = findRequestByNo(data, row.requestNo)
        if (req && req.status !== 'Billed' && req.status !== 'Delivered') {
          req.status = 'Pending'
          req.remarks = `${req.remarks || ''} · Rough rejected`.trim()
        }
      }
    }
    save(data)
    return count
  },

  removeRoughSheet(id: string) {
    const data = load()
    data.roughSheets = data.roughSheets.filter((r) => r.id !== id)
    save(data)
  },

  addInvoice(
    input: Omit<Invoice, 'id' | 'invoiceNo' | 'date'> & { invoiceNo?: string; date?: string },
  ) {
    const data = load()
    const n = data.invoices.length + 1
    const inv: Invoice = {
      ...sessionCentreStamp(),
      ...input,
      id: uid('inv'),
      invoiceNo: input.invoiceNo || `INV-2026-${String(n).padStart(3, '0')}`,
      date: input.date || today(),
      sac: input.sac || '998346',
      updatedAt: new Date().toISOString(),
    }
    data.invoices.unshift(inv)
    save(data)
    return inv
  },

  updateInvoice(id: string, patch: Partial<Omit<Invoice, 'id'>>) {
    const data = load()
    const row = data.invoices.find((i) => i.id === id)
    if (!row) return null
    Object.assign(row, patch, { updatedAt: new Date().toISOString() })
    if (row.amount != null && (row.cgst != null || row.sgst != null || row.igst != null)) {
      row.tax = Number(((row.cgst || 0) + (row.sgst || 0) + (row.igst || 0)).toFixed(2))
      row.total = Number((row.amount + row.tax).toFixed(2))
    }
    save(data)
    return row
  },

  deleteInvoice(id: string) {
    const data = load()
    const before = data.invoices.length
    data.invoices = data.invoices.filter((i) => i.id !== id)
    if (data.invoices.length === before) return false
    save(data)
    return true
  },

  getInvoiceById(id: string) {
    return store.getAll().invoices.find((i) => i.id === id)
  },

  findInvoices(query: { requestNo?: string; invoiceNo?: string }) {
    const data = store.getAll().invoices
    if (query.invoiceNo) {
      const q = query.invoiceNo.trim().toLowerCase()
      return data.filter((i) => i.invoiceNo.toLowerCase() === q)
    }
    if (query.requestNo) {
      const q = query.requestNo.trim().toLowerCase()
      return data.filter((i) => i.requestNo.toLowerCase() === q)
    }
    return data
  },

  addMonthlyInvoice(
    input: Omit<MonthlyInvoice, 'id' | 'invoiceNo' | 'date'> & {
      invoiceNo?: string
      date?: string
    },
  ) {
    const data = load()
    const n = (data.monthlyInvoices?.length || 0) + 1
    const inv: MonthlyInvoice = {
      ...sessionCentreStamp(),
      ...input,
      id: uid('minv'),
      invoiceNo: input.invoiceNo || `M-${String(n).padStart(3, '0')}`,
      date: input.date || today(),
      sac: input.sac || '998346',
      period: input.period || 'Monthly Summary',
      updatedAt: new Date().toISOString(),
    }
    if (!data.monthlyInvoices) data.monthlyInvoices = []
    data.monthlyInvoices.unshift(inv)
    save(data)
    return inv
  },

  updateMonthlyInvoice(id: string, patch: Partial<Omit<MonthlyInvoice, 'id'>>) {
    const data = load()
    const row = (data.monthlyInvoices || []).find((i) => i.id === id)
    if (!row) return null
    Object.assign(row, patch, { updatedAt: new Date().toISOString() })
    row.tax = Number(((row.cgst || 0) + (row.sgst || 0) + (row.igst || 0)).toFixed(2))
    row.total = Number((row.amount + row.tax).toFixed(2))
    save(data)
    return row
  },

  deleteMonthlyInvoice(id: string) {
    const data = load()
    const before = (data.monthlyInvoices || []).length
    data.monthlyInvoices = (data.monthlyInvoices || []).filter((i) => i.id !== id)
    if (data.monthlyInvoices.length === before) return false
    save(data)
    return true
  },

  getMonthlyInvoiceById(id: string) {
    return (store.getAll().monthlyInvoices || []).find((i) => i.id === id)
  },

  addFund(input: Omit<FundEntry, 'id' | 'voucherNo'> & { voucherNo?: string }) {
    const data = load()
    const stamp = sessionCentreStamp()
    const centreFunds = data.funds.filter((f) =>
      stamp.centreKind === 'osc' ? f.centreId === stamp.centreId : !isOscRecord(f),
    )
    const n = centreFunds.length + 1
    const entry: FundEntry = {
      ...input,
      ...stamp,
      centreId: stamp.centreId,
      centreKind: stamp.centreKind,
      id: uid('f'),
      voucherNo: input.voucherNo || String(n),
    }
    data.funds.unshift(entry)
    const partyForStatus = entry.partyName || entry.source
    if (partyForStatus) applyInvoicePaymentStatuses(data, partyForStatus)
    save(data)
    return entry
  },

  updateFund(
    id: string,
    patch: Partial<Omit<FundEntry, 'id' | 'voucherNo' | 'centreId' | 'centreKind'>>,
  ) {
    const data = load()
    const row = data.funds.find((f) => f.id === id)
    if (!row) return null
    const oldParty = row.partyName || row.source
    Object.assign(row, patch)
    if (patch.partyName !== undefined) {
      row.source = patch.partyName || row.source
    } else if (patch.source !== undefined && !row.partyName) {
      row.source = patch.source
    }
    const newParty = row.partyName || row.source
    if (oldParty) applyInvoicePaymentStatuses(data, oldParty)
    if (newParty && normPartyName(newParty) !== normPartyName(oldParty || '')) {
      applyInvoicePaymentStatuses(data, newParty)
    }
    save(data)
    return row
  },

  deleteFund(id: string) {
    const data = load()
    const row = data.funds.find((f) => f.id === id)
    if (!row) return false
    const party = row.partyName || row.source
    data.funds = data.funds.filter((f) => f.id !== id)
    if (party) applyInvoicePaymentStatuses(data, party)
    save(data)
    return true
  },

  getFundById(id: string) {
    return store.getAll().funds.find((f) => f.id === id)
  },

  addExpense(input: Omit<ExpenseEntry, 'id'>) {
    const data = load()
    const stamp = sessionCentreStamp()
    const entry: ExpenseEntry = {
      ...input,
      ...stamp,
      centreId: stamp.centreId,
      centreKind: stamp.centreKind,
      id: uid('e'),
    }
    data.expenses.unshift(entry)
    save(data)
    return entry
  },

  addFireAssay(input: Omit<FireAssay, 'id' | 'assayNo' | 'date'> & { assayNo?: string; date?: string }) {
    const data = load()
    const n = data.fireAssays.length + 1
    const entry: FireAssay = {
      ...input,
      id: uid('fa'),
      assayNo: input.assayNo || `FA-2026-${String(n).padStart(3, '0')}`,
      date: input.date || today(),
    }
    data.fireAssays.unshift(entry)
    save(data)
    return entry
  },

  updateFireAssay(
    id: string,
    patch: Partial<
      Pick<FireAssay, 'sampleWeight' | 'purityFound' | 'declaredPurity' | 'status' | 'analyst' | 'assayType'>
    >,
  ) {
    const data = load()
    const row = data.fireAssays.find((a) => a.id === id)
    if (!row) return false
    Object.assign(row, patch)
    save(data)
    return true
  },

  updateFireAssayByRequestNo(
    requestNo: string,
    patch: Partial<Pick<FireAssay, 'sampleWeight' | 'purityFound' | 'declaredPurity' | 'status'>>,
  ) {
    const data = load()
    const rows = data.fireAssays.filter((a) => a.requestNo === requestNo)
    if (rows.length === 0) return 0
    for (const row of rows) Object.assign(row, patch)
    save(data)
    return rows.length
  },

  updateStock(id: string, quantity: number) {
    const data = load()
    const item = data.stock.find((s) => s.id === id)
    if (item) {
      item.quantity = quantity
      save(data)
    }
  },

  addStock(input: Omit<StockItem, 'id'>) {
    const data = load()
    const item: StockItem = { ...input, id: uid('s') }
    data.stock.unshift(item)
    save(data)
    return item
  },

  /** Sync QM/Lab ledger balance into centre stock summary (reports / dashboard). */
  upsertStockByName(name: string, location: StockItem['location'], quantity: number, unit = 'g') {
    const data = load()
    const existing = data.stock.find((s) => s.name === name && s.location === location)
    if (existing) {
      existing.quantity = quantity
      existing.unit = unit
    } else {
      data.stock.unshift({
        id: uid('s'),
        name,
        unit,
        quantity,
        minLevel: 0,
        location,
      })
    }
    save(data)
  },

  addTouch(input: Omit<TouchRecord, 'id' | 'touchNo' | 'date'>) {
    const data = load()
    const n = data.touches.length + 1
    const entry: TouchRecord = {
      ...sessionCentreStamp(),
      ...input,
      id: uid('t'),
      touchNo: `TH-2026-${String(n).padStart(3, '0')}`,
      date: today(),
    }
    data.touches.unshift(entry)
    save(data)
    return entry
  },

  addXray(input: Omit<XrayEntry, 'id' | 'sheetNo' | 'date'>) {
    const data = load()
    const n = data.xray.length + 1
    const entry: XrayEntry = {
      ...sessionCentreStamp(),
      ...input,
      id: uid('x'),
      sheetNo: `XRF-2026-${String(n).padStart(3, '0')}`,
      date: today(),
    }
    data.xray.unshift(entry)
    save(data)
    return entry
  },

  nextRequestNo() {
    const data = load()
    return `HM-2026-${String(data.requests.length + 1).padStart(3, '0')}`
  },

  getPendingRough(partyId?: string) {
    const rows = store.getAll().pendingRough.filter((r) => r.status === 'Pending')
    if (!partyId) return rows
    return rows.filter((r) => r.partyId === partyId)
  },

  saveManualRequest(input: {
    partyId: string
    partyName: string
    night: string
    date: string
    ahcFileName?: string
    selectedIds: string[]
    source?: 'Manual' | 'Auto'
  }) {
    const data = load()
    const selected = data.pendingRough.filter(
      (r) => input.selectedIds.includes(r.id) && r.status === 'Pending',
    )
    if (selected.length === 0) return []

    const partyAddr = data.parties.find((p) => p.id === input.partyId)?.address || ''

    const created = selected.map((row) => {
      row.status = 'Saved'
      row.night = input.night
      row.date = input.date
      row.ahcFileName = input.ahcFileName
      row.partyId = input.partyId
      row.partyName = input.partyName

      const purity = normalizePurityCode(row.purity)
      row.purity = purity
      const category = findCategory(data, purity)
      const requestNo =
        (row.requestNo && String(row.requestNo).trim()) ||
        `HM-2026-${String(data.requests.length + 1).padStart(3, '0')}`

      let req = findRequestByNo(data, requestNo)
      if (!req) {
        req = {
          id: uid('r'),
          requestNo,
          partyId: input.partyId,
          partyName: input.partyName,
          categoryId: category?.id || '',
          categoryName: category?.name || 'Gold Jewellery',
          pieces: row.pic,
          weight: row.weight,
          purity,
          status: 'Pending',
          source: input.source ?? 'Manual',
          date: input.date,
          remarks: `Night: ${input.night}${input.ahcFileName ? ` · AHC: ${input.ahcFileName}` : ''} · ${row.item}`,
          item: row.item,
          receiptNo: row.receiptNo,
          jobCardNo: row.jobCardNo,
          night: input.night,
          ...sessionCentreStamp(true),
        }
        data.requests.unshift(req)
      }

      // One day-sheet line per item (same Request No can have many Job Cards)
      data.roughSheets.unshift({
        id: uid('rs'),
        partyId: input.partyId,
        partyName: input.partyName,
        item: row.item || 'Jewellery',
        pic: row.pic,
        weight: row.weight,
        purity,
        sampleWeight: 0,
        sampleQty: 1,
        samplingMethod: '',
        cml: row.cml || '',
        status: 'Accepted',
        shift: input.night === 'Night' ? 'Night' : 'Day',
        date: input.date,
        address: partyAddr,
        requestNo,
        jobCardNo: row.jobCardNo || '',
        jobCardSaved: false,
        cornet: 0,
        rejectPic: 0,
        ...sessionCentreStamp(),
      })

      return req
    })

    save(data)
    return created
  },

  saveAutoRequests(input: { night: string; selectedIds: string[] }) {
    const data = load()
    const selected = data.pendingRough.filter(
      (r) => input.selectedIds.includes(r.id) && r.status === 'Pending',
    )
    if (selected.length === 0) return []

    const partyAddr = (partyId: string) =>
      data.parties.find((p) => p.id === partyId)?.address || ''

    const created = selected.map((row) => {
      row.status = 'Saved'
      row.night = input.night

      const purity = normalizePurityCode(row.purity)
      row.purity = purity
      const category = findCategory(data, purity)
      const requestNo =
        (row.requestNo && String(row.requestNo).trim()) ||
        `HM-2026-${String(data.requests.length + 1).padStart(3, '0')}`

      // Upsert HallmarkRequest — keep Manak request number
      let req = findRequestByNo(data, requestNo)
      if (!req) {
        req = {
          id: uid('r'),
          requestNo,
          partyId: row.partyId,
          partyName: row.partyName,
          categoryId: category?.id || '',
          categoryName: category?.name || 'Gold Jewellery',
          pieces: row.pic,
          weight: row.weight,
          purity,
          status: 'Pending',
          source: 'Auto',
          date: row.date || today(),
          remarks: `Auto · Night: ${input.night} · ${row.item}`,
          item: row.item,
          receiptNo: row.receiptNo,
          jobCardNo: row.jobCardNo,
          night: input.night,
          ...sessionCentreStamp(true),
        }
        data.requests.unshift(req)
      } else {
        req.pieces = row.pic
        req.weight = row.weight
        req.purity = purity
        req.item = row.item
        req.receiptNo = row.receiptNo || req.receiptNo
        req.jobCardNo = row.jobCardNo || req.jobCardNo
        req.night = input.night
        if (req.status === 'Billed' || req.status === 'Delivered') {
          /* leave terminal */
        } else {
          req.status = 'Pending'
        }
      }

      // One day-sheet line per Auto item
      data.roughSheets.unshift({
        id: uid('rs'),
        partyId: row.partyId,
        partyName: row.partyName,
        item: row.item || 'Jewellery',
        pic: row.pic,
        weight: row.weight,
        purity,
        sampleWeight: 0,
        sampleQty: 1,
        samplingMethod: '',
        cml: row.cml || '',
        status: 'Accepted',
        shift: input.night === 'Night' ? 'Night' : 'Day',
        date: row.date || today(),
        address: partyAddr(row.partyId),
        requestNo,
        jobCardNo: row.jobCardNo || '',
        jobCardSaved: false,
        cornet: 0,
        rejectPic: 0,
        ...sessionCentreStamp(),
      })

      return req
    })

    save(data)
    return created
  },

  fetchAutoRoughBatch(night: string) {
    const data = load()
    const party = data.parties[Math.floor(Math.random() * data.parties.length)] ?? {
      id: 'p-demo',
      name: 'Demo Party',
    }
    const category = data.categories[Math.floor(Math.random() * data.categories.length)]
    const n = data.pendingRough.length + 1
    const items = ['Necklace', 'Bangles', 'Earrings', 'Ring Set', 'Chain', 'Pendant']
    const entry: PendingRoughRequest = {
      id: uid('pr'),
      partyId: party.id,
      partyName: party.name,
      item: items[n % items.length],
      pic: 4 + (n % 20),
      weight: Number((15 + Math.random() * 90).toFixed(2)),
      purity: category?.purity || '916',
      requestNo: `AR-${today().replace(/-/g, '').slice(2)}-${String(n).padStart(2, '0')}`,
      receiptNo: `RC-${1100 + n}`,
      jobCardNo: `JC-${4600 + n}`,
      cml: `CML-${78000 + n}`,
      night,
      date: today(),
      status: 'Pending',
      ...sessionCentreStamp(),
    }
    data.pendingRough.unshift(entry)
    save(data)
    return entry
  },

  /** Merge Manak Online rows into pendingRough (dedupe by requestNo). */
  importManakRequests(
    night: string,
    rows: Array<{
      partyName: string
      item: string
      pic: number
      weight: number
      purity: string
      requestNo: string
      receiptNo: string
      jobCardNo: string
      cml: string
      date?: string
    }>,
  ) {
    const data = load()
    const existingNos = new Set(
      data.pendingRough.filter((r) => r.status === 'Pending').map((r) => r.requestNo),
    )
    const created: PendingRoughRequest[] = []

    for (const row of rows) {
      const requestNo = String(row.requestNo || '').trim()
      const partyName = String(row.partyName || '').trim()
      const pic = Number(row.pic) || 0
      const weight = Number(row.weight) || 0
      const purity = normalizePurityCode(row.purity)

      // Drop junk parses (list stubs / metal dropdown noise)
      if (!requestNo && !partyName) continue
      if (/^\d{1,4}$/.test(partyName)) continue
      if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(requestNo) && pic <= 0 && weight <= 0) continue
      if (purity === '100' || purity === '10') continue
      const reqDigits = requestNo.replace(/\D/g, '')
      if (reqDigits.length < 6 && pic <= 0 && weight <= 0) continue
      if (!requestNo || existingNos.has(requestNo)) continue
      existingNos.add(requestNo)

      const name = partyName || 'Unknown Party'
      let party = data.parties.find((p) => p.name.toLowerCase() === name.toLowerCase())
      if (!party) {
        party = {
          id: uid('p'),
          name,
          phone: '',
          address: '',
          gstin: '',
          createdAt: today(),
          transactionType: 'Cash',
          licenseNo: '',
          state: '',
          stateCode: '',
          groupName: '',
          skipMinBill: false,
          skipRejectedPics: false,
          skipCutting: false,
          igstApplicable: false,
          discount: 0,
          minBillCalc: false,
          ...sessionCentreStamp(),
        }
        data.parties.unshift(party)
      }

      const entry: PendingRoughRequest = {
        id: uid('pr'),
        partyId: party.id,
        partyName: party.name,
        item: row.item || 'Jewellery',
        pic,
        weight,
        purity,
        requestNo,
        receiptNo: row.receiptNo || '',
        jobCardNo: row.jobCardNo || '',
        cml: row.cml || '',
        night,
        date: row.date || today(),
        status: 'Pending',
        ...sessionCentreStamp(),
      }
      data.pendingRough.unshift(entry)
      created.push(entry)
    }

    if (created.length) save(data)
    return created
  },

  addPendingRough(input: Omit<PendingRoughRequest, 'id' | 'status'>) {
    const data = load()
    const entry: PendingRoughRequest = {
      ...sessionCentreStamp(),
      ...input,
      id: uid('pr'),
      status: 'Pending',
    }
    data.pendingRough.unshift(entry)
    save(data)
    return entry
  },
}
