import { getActiveTenantId } from './tenant'
import { getStoreCache, setStoreCache } from './tenantCache'

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
}

export type Category = {
  id: string
  name: string
  purity: string
  metal: 'Gold' | 'Silver' | 'Platinum'
  rate: number
}

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
  co?: string
  sampleTagId?: string
  cornet?: number
  rejectPic?: number
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
}

export type ExpenseEntry = {
  id: string
  date: string
  category: string
  amount: number
  paidTo: string
  remarks: string
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
}

export type XrayEntry = {
  id: string
  sheetNo: string
  requestNo: string
  partyName: string
  reading: number
  purity: string
  date: string
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
}

type StoreShape = {
  parties: Party[]
  categories: Category[]
  requests: HallmarkRequest[]
  roughSheets: RoughSheetEntry[]
  pendingRough: PendingRoughRequest[]
  invoices: Invoice[]
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
    requests: [],
    roughSheets: [],
    pendingRough: [],
    invoices: [],
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
    co: r.co ?? '',
    sampleTagId: r.sampleTagId ?? '',
    cornet: r.cornet,
    rejectPic: r.rejectPic ?? 0,
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
  }
}

function normalizeLoaded(parsed: StoreShape): StoreShape {
  if (!parsed.pendingRough) parsed.pendingRough = []
  parsed.parties = (parsed.parties ?? []).map((p) => normalizeParty(p))
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

export const store = {
  getAll: () => load(),

  addParty(input: Omit<Party, 'id' | 'createdAt'>) {
    const data = load()
    const party: Party = { ...input, id: uid('p'), createdAt: today() }
    data.parties.unshift(party)
    save(data)
    return party
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

  addRequest(input: Omit<HallmarkRequest, 'id' | 'requestNo' | 'date'>) {
    const data = load()
    const n = data.requests.length + 1
    const req: HallmarkRequest = {
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
    if (item) {
      item.status = status
      save(data)
    }
  },

  addRoughSheet(input: Omit<RoughSheetEntry, 'id' | 'date' | 'status'> & { status?: RoughSheetEntry['status'] }) {
    const data = load()
    const entry: RoughSheetEntry = {
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
      // Sample weight automatically added to weight after save
      row.weight = Number((row.weight + row.sampleWeight).toFixed(3))
      row.status = 'Accepted'
      accepted.push(row)

      const category =
        data.categories.find((c) => c.purity === row.purity) ?? data.categories[0]
      const n = data.requests.length + 1
      data.requests.unshift({
        id: uid('r'),
        requestNo: `HM-2026-${String(n).padStart(3, '0')}`,
        partyId: row.partyId,
        partyName: row.partyName,
        categoryId: category.id,
        categoryName: category.name,
        pieces: row.pic,
        weight: row.weight,
        purity: row.purity,
        status: 'In Progress',
        source: 'Manual',
        date: row.date,
        remarks: `Rough accepted · Sample ${row.sampleWeight}g · ${row.samplingMethod}`,
      })
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
      partyName: input.partyName,
      requestNo: input.requestNo,
      amount: input.amount,
      tax: input.tax,
      total: input.total,
      status: input.status,
      id: uid('inv'),
      invoiceNo: input.invoiceNo || `INV-2026-${String(n).padStart(3, '0')}`,
      date: input.date || today(),
    }
    data.invoices.unshift(inv)
    save(data)
    return inv
  },

  addFund(input: Omit<FundEntry, 'id' | 'voucherNo'> & { voucherNo?: string }) {
    const data = load()
    const n = data.funds.length + 1
    const entry: FundEntry = {
      ...input,
      id: uid('f'),
      voucherNo: input.voucherNo || String(n),
    }
    data.funds.unshift(entry)
    save(data)
    return entry
  },

  addExpense(input: Omit<ExpenseEntry, 'id'>) {
    const data = load()
    const entry: ExpenseEntry = { ...input, id: uid('e') }
    data.expenses.unshift(entry)
    save(data)
    return entry
  },

  addFireAssay(input: Omit<FireAssay, 'id' | 'assayNo' | 'date'>) {
    const data = load()
    const n = data.fireAssays.length + 1
    const entry: FireAssay = {
      ...input,
      id: uid('fa'),
      assayNo: `FA-2026-${String(n).padStart(3, '0')}`,
      date: today(),
    }
    data.fireAssays.unshift(entry)
    save(data)
    return entry
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

  addTouch(input: Omit<TouchRecord, 'id' | 'touchNo' | 'date'>) {
    const data = load()
    const n = data.touches.length + 1
    const entry: TouchRecord = {
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
    const rows = load().pendingRough.filter((r) => r.status === 'Pending')
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

    const created = selected.map((row) => {
      row.status = 'Saved'
      row.night = input.night
      row.date = input.date
      row.ahcFileName = input.ahcFileName
      row.partyId = input.partyId
      row.partyName = input.partyName

      const category =
        data.categories.find((c) => c.purity === row.purity) ?? data.categories[0]
      const n = data.requests.length + 1
      const req: HallmarkRequest = {
        id: uid('r'),
        requestNo: `HM-2026-${String(n).padStart(3, '0')}`,
        partyId: input.partyId,
        partyName: input.partyName,
        categoryId: category.id,
        categoryName: category.name,
        pieces: row.pic,
        weight: row.weight,
        purity: row.purity,
        status: 'Pending',
        source: input.source ?? 'Manual',
        date: input.date,
        remarks: `Night: ${input.night}${input.ahcFileName ? ` · AHC: ${input.ahcFileName}` : ''} · ${row.item}`,
      }
      data.requests.unshift(req)
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

    const created = selected.map((row) => {
      row.status = 'Saved'
      row.night = input.night

      const category =
        data.categories.find((c) => c.purity === row.purity) ?? data.categories[0]
      const n = data.requests.length + 1
      const req: HallmarkRequest = {
        id: uid('r'),
        requestNo: `HM-2026-${String(n).padStart(3, '0')}`,
        partyId: row.partyId,
        partyName: row.partyName,
        categoryId: category.id,
        categoryName: category.name,
        pieces: row.pic,
        weight: row.weight,
        purity: row.purity,
        status: 'Pending',
        source: 'Auto',
        date: today(),
        remarks: `Auto · Night: ${input.night} · ${row.item}`,
      }
      data.requests.unshift(req)
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
      if (!row.requestNo || existingNos.has(row.requestNo)) continue
      existingNos.add(row.requestNo)

      const name = row.partyName.trim() || 'Unknown Party'
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
        }
        data.parties.unshift(party)
      }

      const entry: PendingRoughRequest = {
        id: uid('pr'),
        partyId: party.id,
        partyName: party.name,
        item: row.item || 'Jewellery',
        pic: Number(row.pic) || 0,
        weight: Number(row.weight) || 0,
        purity: String(row.purity || '916').replace(/\D/g, '').slice(0, 3) || '916',
        requestNo: row.requestNo,
        receiptNo: row.receiptNo || '',
        jobCardNo: row.jobCardNo || '',
        cml: row.cml || '',
        night,
        date: row.date || today(),
        status: 'Pending',
      }
      data.pendingRough.unshift(entry)
      created.push(entry)
    }

    if (created.length) save(data)
    return created
  },

  addPendingRough(input: Omit<PendingRoughRequest, 'id' | 'status'>) {
    const data = load()
    const entry: PendingRoughRequest = { ...input, id: uid('pr'), status: 'Pending' }
    data.pendingRough.unshift(entry)
    save(data)
    return entry
  },
}
