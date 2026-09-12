/**
 * Other Services — isolated from Hallmarking bills, invoices, and request numbers.
 * Fund & Trace rows use source OTHER_SERVICE and voucherNo RC-OS-*.
 */

export const OTHER_SERVICE_FUND_SOURCE = 'OTHER_SERVICE'
export const OTHER_SERVICE_RECEIPT_PREFIX = 'RC-OS-'

export type OtherServiceKind = 'weight' | 'piece' | 'manual'
export type OtherServiceUnit = 'GM' | 'KG' | 'Piece' | 'Fixed' | 'Other'
export type OtherServiceRateBasis = 'Per Gram' | 'Per KG' | 'Per Piece' | 'Fixed'
export type OtherServicePaymentMode = 'Cash' | 'UPI' | 'Bank' | 'Other'
export type OtherServicePaymentStatus = 'Paid' | 'Partial' | 'Pending'
export type OtherServiceRecordStatus = 'Open' | 'Cancelled'

export type OtherServiceLineItem = {
  id?: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export type OtherServiceLineItemInput = {
  id?: string
  description?: string
  quantity?: number
  rate?: number
  amount?: number
}

export type OtherServiceType = {
  id: string
  name: string
  kind: OtherServiceKind
  slipPrefix: string
  builtIn: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
}

export type OtherService = {
  id: string
  slipNo: string
  typeId: string
  typeName: string
  kind: OtherServiceKind
  customerName: string
  address: string
  contactNo: string
  date: string
  dateTime: string
  unit: OtherServiceUnit
  quantity: number
  rate: number
  rateBasis: OtherServiceRateBasis
  totalAmount: number
  amountReceived: number
  pendingAmount: number
  paymentMode: OtherServicePaymentMode
  paymentStatus: OtherServicePaymentStatus
  item: string
  productDescription: string
  /** Laser Soldering (and other piece services): multiple jewellery items on one slip. */
  items?: OtherServiceLineItem[]
  remark: string
  receiptNo?: string
  fundId?: string
  status: OtherServiceRecordStatus
  cancelledAt?: string
  cancelledBy?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  operationalPeriod?: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type OtherServiceReceipt = {
  id: string
  receiptNo: string
  serviceId: string
  slipNo: string
  printedAt: string
  reprintCount: number
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  operationalPeriod?: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type OtherServiceAudit = {
  id: string
  at: string
  action:
    | 'service_created'
    | 'service_edited'
    | 'payment_recorded'
    | 'receipt_generated'
    | 'receipt_reprinted'
    | 'service_cancelled'
    | 'type_created'
    | 'type_changed'
  serviceId?: string
  typeId?: string
  detail: string
  createdBy: string
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export const WEIGHT_UNITS: OtherServiceUnit[] = ['GM', 'KG']
export const MANUAL_UNITS: OtherServiceUnit[] = ['GM', 'KG', 'Piece', 'Fixed', 'Other']
export const PAYMENT_MODES: OtherServicePaymentMode[] = ['Cash', 'UPI', 'Bank', 'Other']
export const WEIGHT_UNIT_OPTIONS: Array<{ value: 'GM' | 'KG'; label: string }> = [
  { value: 'GM', label: 'Gram (g)' },
  { value: 'KG', label: 'Kilogram (kg)' },
]

const BUILTIN_DEFS: Array<Pick<OtherServiceType, 'id' | 'name' | 'kind' | 'slipPrefix'>> = [
  { id: 'os-type-vibrator', name: 'Vibrator', kind: 'weight', slipPrefix: 'VS' },
  { id: 'os-type-silver-polish', name: 'Silver Polish', kind: 'weight', slipPrefix: 'VS' },
  { id: 'os-type-laser', name: 'Laser Soldering', kind: 'piece', slipPrefix: 'LS' },
  { id: 'os-type-manual', name: 'Manual Service', kind: 'manual', slipPrefix: 'MS' },
]

export function defaultOtherServiceTypes(now = new Date().toISOString()): OtherServiceType[] {
  return BUILTIN_DEFS.map((d) => ({
    ...d,
    builtIn: true,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
  }))
}

export function ensureOtherServiceTypes(types: OtherServiceType[] | undefined): OtherServiceType[] {
  const list = Array.isArray(types) ? [...types] : []
  const ids = new Set(list.map((t) => t.id))
  const names = new Set(list.map((t) => t.name.trim().toLowerCase()))
  const now = new Date().toISOString()
  for (const builtin of defaultOtherServiceTypes(now)) {
    if (ids.has(builtin.id)) continue
    if (names.has(builtin.name.trim().toLowerCase())) continue
    list.push(builtin)
  }
  return list
}

export function isOtherServiceFund(f: { source?: string; voucherNo?: string } | null | undefined): boolean {
  if (!f) return false
  if (String(f.source || '') === OTHER_SERVICE_FUND_SOURCE) return true
  return String(f.voucherNo || '')
    .trim()
    .toUpperCase()
    .startsWith(OTHER_SERVICE_RECEIPT_PREFIX)
}

/** Hallmarking voucher serials ignore Other Services rows. */
export function hallmarkingFundVoucherCandidates<T extends { source?: string; voucherNo?: string }>(
  funds: T[],
): T[] {
  return funds.filter((f) => !isOtherServiceFund(f))
}

export function money2(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Number(x.toFixed(2))
}

export function paymentStatusOf(total: number, received: number): OtherServicePaymentStatus {
  const t = money2(total)
  const r = money2(received)
  if (r <= 0) return 'Pending'
  if (r + 0.009 >= t) return 'Paid'
  return 'Partial'
}

export function pendingAmountOf(total: number, received: number) {
  return money2(Math.max(0, money2(total) - money2(received)))
}

export function fundModeOf(mode: OtherServicePaymentMode): 'Cash' | 'UPI' | 'Bank' {
  if (mode === 'UPI' || mode === 'Bank') return mode
  return 'Cash'
}

export function defaultUnitForKind(kind: OtherServiceKind): OtherServiceUnit {
  if (kind === 'piece') return 'Piece'
  if (kind === 'weight') return 'GM'
  return 'GM'
}

export function defaultRateBasisForUnit(unit: OtherServiceUnit): OtherServiceRateBasis {
  if (unit === 'KG') return 'Per KG'
  if (unit === 'Piece') return 'Per Piece'
  if (unit === 'Fixed') return 'Fixed'
  return 'Per Gram'
}

/** Vibrator / Silver Polish always charge per KG, even when the customer quantity is in grams. */
export function defaultRateBasisForKind(kind: OtherServiceKind, unit: OtherServiceUnit): OtherServiceRateBasis {
  if (kind === 'weight') return 'Per KG'
  return defaultRateBasisForUnit(unit)
}

export function rateBasisMatchesUnit(
  unit: OtherServiceUnit,
  rateBasis: OtherServiceRateBasis,
  kind?: OtherServiceKind,
): boolean {
  if (kind === 'weight') {
    if (unit === 'KG') return rateBasis === 'Per KG'
    if (unit === 'GM') return rateBasis === 'Per KG' || rateBasis === 'Per Gram'
    return false
  }
  if (unit === 'GM') return rateBasis === 'Per Gram'
  if (unit === 'KG') return rateBasis === 'Per KG'
  if (unit === 'Piece') return rateBasis === 'Per Piece'
  if (unit === 'Fixed') return rateBasis === 'Fixed'
  return true
}

export function calculateLineItemAmount(quantity: number, rate: number): number {
  return money2(quantity * rate)
}

export function normalizeOtherServiceLineItem(
  raw: OtherServiceLineItemInput | null | undefined,
  index: number,
): { ok: true; item: OtherServiceLineItem } | { ok: false; error: string } {
  const description = String(raw?.description || '').trim()
  if (!description) return { ok: false, error: `Item ${index + 1}: description is required` }
  const quantity = Number(raw?.quantity)
  const rate = Number(raw?.rate)
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    return { ok: false, error: `Item ${index + 1}: quantity must be a positive integer` }
  }
  if (!Number.isFinite(rate) || rate < 0) {
    return { ok: false, error: `Item ${index + 1}: rate must be zero or greater` }
  }
  const id = String(raw?.id || '').trim()
  return {
    ok: true,
    item: {
      ...(id ? { id } : {}),
      description,
      quantity,
      rate: money2(rate),
      amount: calculateLineItemAmount(quantity, rate),
    },
  }
}

export function normalizeOtherServiceLineItems(
  raw: OtherServiceLineItemInput[] | null | undefined,
): { ok: true; items: OtherServiceLineItem[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'At least one item is required for Laser Soldering' }
  }
  const items: OtherServiceLineItem[] = []
  for (let i = 0; i < raw.length; i++) {
    const one = normalizeOtherServiceLineItem(raw[i], i)
    if (!one.ok) return one
    items.push(one.item)
  }
  return { ok: true, items }
}

function calculateWeightAmount(
  quantity: number,
  unit: OtherServiceUnit,
  rate: number,
  rateBasis: OtherServiceRateBasis,
): { ok: true; total: number } | { ok: false; error: string } {
  if (unit !== 'GM' && unit !== 'KG') {
    return { ok: false, error: 'Unit must be Gram (g) or Kilogram (kg)' }
  }
  if (quantity <= 0) return { ok: false, error: 'Quantity / weight must be greater than zero' }
  if (rateBasis === 'Per KG' && unit === 'GM') {
    return { ok: true, total: money2((quantity / 1000) * rate) }
  }
  return { ok: true, total: money2(quantity * rate) }
}

export function calculateOtherServiceTotal(input: {
  kind: OtherServiceKind
  unit: OtherServiceUnit
  rateBasis: OtherServiceRateBasis
  quantity: number
  rate: number
  items?: OtherServiceLineItemInput[] | null
}): { ok: true; total: number } | { ok: false; error: string } {
  if (input.kind === 'piece' && input.items != null) {
    const normalized = normalizeOtherServiceLineItems(input.items)
    if (!normalized.ok) return { ok: false, error: normalized.error }
    const total = money2(normalized.items.reduce((sum, item) => sum + item.amount, 0))
    if (!Number.isFinite(total)) return { ok: false, error: 'Amount cannot be calculated' }
    return { ok: true, total }
  }

  const qty = Number(input.quantity)
  const rate = Number(input.rate)
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, error: 'Quantity / weight must be a valid number' }
  if (!Number.isFinite(rate) || rate < 0) return { ok: false, error: 'Rate must be a valid number' }
  if (!rateBasisMatchesUnit(input.unit, input.rateBasis, input.kind)) {
    return {
      ok: false,
      error:
        input.kind === 'weight'
          ? `Rate basis "${input.rateBasis}" is not valid for unit "${input.unit}".`
          : `Rate basis "${input.rateBasis}" does not match unit "${input.unit}". Units are not converted automatically.`,
    }
  }

  if (input.kind === 'weight') {
    return calculateWeightAmount(qty, input.unit, rate, input.rateBasis)
  }

  if (input.kind === 'piece' || input.unit === 'Piece') {
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: 'Number of pieces must be a positive integer' }
    return { ok: true, total: money2(qty * rate) }
  }

  if (input.unit === 'Fixed' || input.rateBasis === 'Fixed') {
    return { ok: true, total: money2(rate) }
  }

  if (input.unit === 'GM' || input.unit === 'KG') {
    if (qty <= 0) return { ok: false, error: 'Quantity / weight must be greater than zero' }
    return { ok: true, total: money2(qty * rate) }
  }

  if (input.unit === 'Other') {
    if (qty <= 0) return { ok: false, error: 'Quantity must be greater than zero' }
    return { ok: true, total: money2(qty * rate) }
  }

  return { ok: false, error: 'Cannot calculate total for this unit / rate basis' }
}

export function normalizeSlipPrefix(prefix: string, kind: OtherServiceKind): string {
  const p = String(prefix || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
  if (p) return p
  if (kind === 'weight') return 'VS'
  if (kind === 'piece') return 'LS'
  return 'MS'
}

function nextPrefixedSerial(prefix: string, used: Iterable<string>, width = 6): string {
  const stem = `${prefix}-`
  const usedSet = new Set(Array.from(used).map((s) => String(s || '').trim()))
  let max = 0
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i')
  for (const value of usedSet) {
    const m = value.match(re)
    if (m) max = Math.max(max, Number(m[1]) || 0)
  }
  let seq = max + 1
  let candidate = `${stem}${String(seq).padStart(width, '0')}`
  while (usedSet.has(candidate)) {
    seq += 1
    candidate = `${stem}${String(seq).padStart(width, '0')}`
  }
  return candidate
}

export function nextOtherServiceSlipNo(
  prefix: string,
  existing: Array<{ slipNo?: string }>,
): string {
  return nextPrefixedSerial(
    prefix,
    existing.map((r) => r.slipNo || ''),
  )
}

export function nextOtherServiceReceiptNo(
  existingReceipts: Array<{ receiptNo?: string }>,
  existingServices: Array<{ receiptNo?: string }>,
  existingFunds: Array<{ voucherNo?: string }>,
): string {
  const used = [
    ...existingReceipts.map((r) => r.receiptNo || ''),
    ...existingServices.map((s) => s.receiptNo || ''),
    ...existingFunds.filter(isOtherServiceFund).map((f) => f.voucherNo || ''),
  ]
  return nextPrefixedSerial('RC-OS', used)
}

export function validateContactNo(value: string): string | null {
  const raw = String(value || '').trim()
  if (!raw) return 'Contact number is required'
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 10) return 'Contact number must be 10 digits'
  return null
}

export function validateOtherServiceInput(input: {
  typeId: string
  customerName: string
  contactNo: string
  kind: OtherServiceKind
  unit: OtherServiceUnit
  rateBasis: OtherServiceRateBasis
  quantity: number
  rate: number
  amountReceived: number
  items?: OtherServiceLineItemInput[] | null
}): string | null {
  if (!String(input.typeId || '').trim()) return 'Service type is required'
  if (!String(input.customerName || '').trim()) return 'Customer name is required'
  const contactErr = validateContactNo(input.contactNo)
  if (contactErr) return contactErr
  if (input.kind === 'weight' && input.unit !== 'GM' && input.unit !== 'KG') {
    return 'Unit must be Gram (g) or Kilogram (kg)'
  }
  if (input.kind === 'piece' && input.items == null && input.unit !== 'Piece') {
    return 'Unit must be Piece'
  }
  const calc = calculateOtherServiceTotal(input)
  if (!calc.ok) return calc.error
  const received = Number(input.amountReceived)
  if (!Number.isFinite(received) || received < 0) return 'Amount received must be a valid number'
  if (money2(received) > calc.total + 0.009) return 'Amount received cannot exceed total amount'
  return null
}

export function otherServiceFundRemarks(row: Pick<OtherService, 'typeName' | 'slipNo' | 'customerName' | 'paymentMode'>) {
  const bits = [row.typeName, row.slipNo, row.customerName].filter(Boolean)
  if (row.paymentMode === 'Other') bits.push('Mode: Other')
  return bits.join(' · ')
}

export function reportBucketForService(row: Pick<OtherService, 'typeName' | 'kind'>): string {
  const name = String(row.typeName || '').trim()
  const key = name.toLowerCase()
  if (key === 'vibrator') return 'Vibrator'
  if (key === 'silver polish') return 'Silver Polish'
  if (key.includes('laser')) return 'Laser Soldering'
  if (row.kind === 'manual' || key.includes('manual')) return 'Manual Services'
  if (key.includes('vibrator')) return 'Vibrator'
  if (key.includes('polish')) return 'Silver Polish'
  return name || 'Other'
}

export function formatOtherServiceUnit(unit: OtherServiceUnit): string {
  if (unit === 'GM') return 'g'
  if (unit === 'KG') return 'KG'
  if (unit === 'Piece') return 'pcs'
  return unit
}

export function formatOtherServiceQuantity(quantity: number, unit: OtherServiceUnit): string {
  if (unit === 'Fixed') return 'Fixed'
  if (unit === 'Piece') return `${quantity} ${quantity === 1 ? 'pc' : 'pcs'}`
  if (unit === 'GM') return `${quantity} g`
  if (unit === 'KG') return `${quantity} KG`
  return `${quantity} ${unit}`
}

export function formatOtherServiceRate(rate: number, rateBasis: OtherServiceRateBasis): string {
  const amount = `₹ ${money2(rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (rateBasis === 'Per KG') return `${amount} / KG`
  if (rateBasis === 'Per Gram') return `${amount} / g`
  if (rateBasis === 'Per Piece') return `${amount} / pc`
  if (rateBasis === 'Fixed') return `${amount} (Fixed)`
  return amount
}

export function otherServiceLineItemsOf(
  row: Pick<OtherService, 'kind' | 'item' | 'quantity' | 'rate' | 'totalAmount' | 'items'>,
): OtherServiceLineItem[] {
  if (Array.isArray(row.items) && row.items.length > 0) {
    return row.items.map((item, index) => {
      const normalized = normalizeOtherServiceLineItem(item, index)
      if (normalized.ok) return normalized.item
      return {
        description: String(item.description || '').trim() || 'Item',
        quantity: Number(item.quantity) || 0,
        rate: money2(item.rate),
        amount: money2(item.amount ?? calculateLineItemAmount(Number(item.quantity) || 0, Number(item.rate) || 0)),
      }
    })
  }
  if (row.kind === 'piece') {
    const description = String(row.item || '').trim()
    if (!description && !(Number(row.quantity) > 0)) return []
    return [
      {
        description: description || 'Item',
        quantity: Number(row.quantity) || 0,
        rate: money2(row.rate),
        amount: money2(row.totalAmount),
      },
    ]
  }
  return []
}

export function summarizeOtherServiceItems(items: OtherServiceLineItem[]): string {
  return items.map((item) => item.description).filter(Boolean).join(', ')
}

export function otherServiceReceiptLines(
  row: Pick<
    OtherService,
    'kind' | 'typeName' | 'item' | 'productDescription' | 'quantity' | 'unit' | 'rate' | 'rateBasis' | 'totalAmount' | 'items'
  >,
): string[] {
  const items = otherServiceLineItemsOf(row)
  if (row.kind === 'piece' && items.length) {
    return [
      ...items.map(
        (item) => `${item.description} | ${item.quantity} pcs | ${item.rate} | ${item.amount}`,
      ),
      `Total | ${row.totalAmount}`,
    ]
  }
  return [
    `Quantity: ${formatOtherServiceQuantity(row.quantity, row.unit)}`,
    `Rate: ${formatOtherServiceRate(row.rate, row.rateBasis)}`,
    `Amount: ${row.totalAmount}`,
  ]
}

export function totalPiecesOf(items: OtherServiceLineItem[]): number {
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}

function paymentModeOf(value: unknown): OtherServicePaymentMode {
  const mode = String(value || '').trim()
  if (mode === 'UPI' || mode === 'Bank' || mode === 'Other' || mode === 'Cash') return mode
  return 'Cash'
}

/**
 * Recalculate Other Services totals on the server store blob.
 * Does not trust client-provided totalAmount / line amounts.
 * Does not convert stored gram quantities into kilograms.
 */
export function sanitizeOtherServicesStorePayload(data: Record<string, unknown>): void {
  if (!data || typeof data !== 'object') return
  const hasTypes = Array.isArray(data.otherServiceTypes)
  const types = ensureOtherServiceTypes(hasTypes ? (data.otherServiceTypes as OtherServiceType[]) : [])
  if (hasTypes) data.otherServiceTypes = types
  if (!Array.isArray(data.otherServices)) return
  const typeById = new Map(types.map((t) => [t.id, t]))
  const rows = data.otherServices
  const next: OtherService[] = []

  for (const raw of rows) {
    const rec = asRecord(raw)
    if (!rec) continue
    const row = rec as unknown as OtherService
    const type = typeById.get(String(row.typeId || ''))
    const kind: OtherServiceKind = type?.kind || row.kind
    if (kind !== 'weight' && kind !== 'piece' && kind !== 'manual') continue
    row.kind = kind
    if (type?.name) row.typeName = type.name

    const unit = row.unit
    const rateBasis = row.rateBasis
    const quantity = Number(row.quantity)
    const rate = Number(row.rate)
    const itemsInput = Array.isArray(row.items) && row.items.length > 0 ? row.items : undefined
    const calc = calculateOtherServiceTotal({
      kind,
      unit,
      rateBasis,
      quantity,
      rate,
      items: kind === 'piece' && itemsInput ? itemsInput : undefined,
    })
    if (!calc.ok) {
      next.push(row)
      continue
    }

    if (kind === 'piece' && itemsInput) {
      const normalized = normalizeOtherServiceLineItems(itemsInput)
      if (!normalized.ok) {
        next.push(row)
        continue
      }
      row.items = normalized.items
      row.quantity = totalPiecesOf(normalized.items)
      row.unit = 'Piece'
      row.rateBasis = 'Per Piece'
      row.item = summarizeOtherServiceItems(normalized.items)
      row.rate = normalized.items.length === 1 ? normalized.items[0].rate : money2(row.rate)
    } else {
      row.quantity = quantity
      row.rate = money2(rate)
    }

    const receivedRaw = Number(row.amountReceived)
    const received = money2(!Number.isFinite(receivedRaw) || receivedRaw < 0 ? 0 : receivedRaw)
    const amountReceived = received > calc.total + 0.009 ? calc.total : received
    row.totalAmount = calc.total
    row.amountReceived = amountReceived
    row.pendingAmount = pendingAmountOf(calc.total, amountReceived)
    row.paymentStatus = paymentStatusOf(calc.total, amountReceived)
    row.paymentMode = paymentModeOf(row.paymentMode)
    if (row.status !== 'Cancelled') row.status = 'Open'
    next.push(row)
  }
  data.otherServices = next

  const funds = Array.isArray(data.funds) ? data.funds : []
  for (const fundRaw of funds) {
    const fund = asRecord(fundRaw)
    if (!fund) continue
    if (!isOtherServiceFund({ source: String(fund.source || ''), voucherNo: String(fund.voucherNo || '') })) {
      continue
    }
    const fundId = String(fund.id || '')
    const linked = next.find((row) => row.fundId && row.fundId === fundId)
    if (!linked) continue
    fund.source = OTHER_SERVICE_FUND_SOURCE
    fund.amount = linked.amountReceived
    if (linked.receiptNo) fund.voucherNo = linked.receiptNo
    fund.remarks = otherServiceFundRemarks(linked)
    fund.mode = fundModeOf(linked.paymentMode)
  }
}
