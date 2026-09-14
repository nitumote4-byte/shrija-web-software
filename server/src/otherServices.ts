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

/** Weight unit stored on multi-item Silver Polish / Vibrating rows. */
export type OtherServiceWeightUnit = 'GM' | 'KG'

export type OtherServiceLineItem = {
  id?: string
  /** Product / jewellery name (also used for Laser Soldering item description). */
  description: string
  quantity: number
  /** Present on weight multi-item rows; omitted for Laser Soldering piece rows. */
  unit?: OtherServiceWeightUnit
  /** Rate per piece (laser) or rate per KG (weight multi-item). */
  rate: number
  amount: number
}

export type OtherServiceLineItemInput = {
  id?: string
  description?: string
  /** Alias accepted for weight multi-item product name. */
  productName?: string
  quantity?: number
  unit?: OtherServiceUnit | OtherServiceWeightUnit | string
  rate?: number
  ratePerKg?: number
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
  /**
   * Multi-item rows for Laser Soldering (piece) and Silver Polish / Vibrating (weight).
   * Legacy weight slips may omit this and use top-level quantity/unit/rate instead.
   */
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

/** Unified weight service replacing separate Vibrator / Silver Polish / Braveting cards. */
export const UNIFIED_WEIGHT_SERVICE_ID = 'os-type-silver-polish-vibrating'
export const UNIFIED_WEIGHT_SERVICE_NAME = 'Silver Polish / Vibrating'
export const UNIFIED_WEIGHT_SERVICE_SUBTITLE = 'Silver polishing / vibrating / braveting'

/** Historical built-in IDs kept readable; deactivated for new entry selection. */
export const LEGACY_WEIGHT_SERVICE_IDS = [
  'os-type-vibrator',
  'os-type-silver-polish',
  'os-type-braveting',
] as const

/** Initial product presets for Silver Polish / Vibrating — not an exclusive allow-list. */
export const WEIGHT_PRODUCT_PRESETS = ['Dulhan Payal', 'Ring', 'Choti'] as const
export const WEIGHT_PRODUCT_CUSTOM = 'Other / Custom Item'

const BUILTIN_DEFS: Array<Pick<OtherServiceType, 'id' | 'name' | 'kind' | 'slipPrefix'>> = [
  {
    id: UNIFIED_WEIGHT_SERVICE_ID,
    name: UNIFIED_WEIGHT_SERVICE_NAME,
    kind: 'weight',
    slipPrefix: 'VS',
  },
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

export function isLegacyMergedWeightServiceName(name: string): boolean {
  const key = String(name || '')
    .trim()
    .toLowerCase()
  return (
    key === 'vibrator' ||
    key === 'silver polish' ||
    key === 'braveting' ||
    key === 'vibrating' ||
    key === 'silver polishing'
  )
}

export function isLegacyMergedWeightServiceType(
  type: Pick<OtherServiceType, 'id' | 'name'> | null | undefined,
): boolean {
  if (!type) return false
  if (type.id === UNIFIED_WEIGHT_SERVICE_ID) return false
  if ((LEGACY_WEIGHT_SERVICE_IDS as readonly string[]).includes(type.id)) return true
  return isLegacyMergedWeightServiceName(type.name)
}

export function isUnifiedWeightServiceType(
  type: Pick<OtherServiceType, 'id' | 'name' | 'kind'> | null | undefined,
): boolean {
  if (!type) return false
  if (type.id === UNIFIED_WEIGHT_SERVICE_ID) return true
  const key = String(type.name || '')
    .trim()
    .toLowerCase()
  return type.kind === 'weight' && (key === UNIFIED_WEIGHT_SERVICE_NAME.toLowerCase() || key.includes('silver polish / vibrat'))
}

/** Types shown on New Service Entry (legacy merged weight types are hidden). */
export function selectableOtherServiceTypes(types: OtherServiceType[]): OtherServiceType[] {
  return types.filter((t) => t.active && !isLegacyMergedWeightServiceType(t))
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
    ids.add(builtin.id)
    names.add(builtin.name.trim().toLowerCase())
  }
  // Keep legacy Vibrator / Silver Polish / Braveting rows for history, but hide from new entry.
  for (const row of list) {
    if (isLegacyMergedWeightServiceType(row)) {
      row.active = false
      row.builtIn = row.builtIn || (LEGACY_WEIGHT_SERVICE_IDS as readonly string[]).includes(row.id)
    }
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

export function calculateWeightLineItemAmount(
  quantity: number,
  unit: OtherServiceWeightUnit,
  ratePerKg: number,
): number {
  if (unit === 'GM') return money2((quantity / 1000) * ratePerKg)
  return money2(quantity * ratePerKg)
}

function lineItemDescriptionOf(raw: OtherServiceLineItemInput | null | undefined): string {
  return String(raw?.description || raw?.productName || '').trim()
}

function lineItemRateOf(raw: OtherServiceLineItemInput | null | undefined): number {
  if (raw?.ratePerKg != null && Number.isFinite(Number(raw.ratePerKg))) return Number(raw.ratePerKg)
  return Number(raw?.rate)
}

export function parseWeightLineUnit(
  value: unknown,
): OtherServiceWeightUnit | null {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
  if (raw === 'GM' || raw === 'G' || raw === 'GRAM' || raw === 'GRAMS') return 'GM'
  if (raw === 'KG' || raw === 'KILOGRAM' || raw === 'KILOGRAMS') return 'KG'
  return null
}

export function normalizeOtherServiceLineItem(
  raw: OtherServiceLineItemInput | null | undefined,
  index: number,
): { ok: true; item: OtherServiceLineItem } | { ok: false; error: string } {
  const description = lineItemDescriptionOf(raw)
  if (!description) return { ok: false, error: `Item ${index + 1}: description is required` }
  const quantity = Number(raw?.quantity)
  const rate = lineItemRateOf(raw)
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

export function normalizeOtherServiceWeightLineItem(
  raw: OtherServiceLineItemInput | null | undefined,
  index: number,
): { ok: true; item: OtherServiceLineItem } | { ok: false; error: string } {
  const description = lineItemDescriptionOf(raw)
  if (!description) return { ok: false, error: `Item ${index + 1}: product / item name is required` }
  const quantity = Number(raw?.quantity)
  const rate = lineItemRateOf(raw)
  const unit = parseWeightLineUnit(raw?.unit)
  if (!unit) {
    return { ok: false, error: `Item ${index + 1}: unit must be Gram (g) or Kilogram (kg)` }
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: `Item ${index + 1}: weight / quantity must be greater than zero` }
  }
  if (!Number.isFinite(rate) || rate < 0) {
    return { ok: false, error: `Item ${index + 1}: rate per KG must be zero or greater` }
  }
  const id = String(raw?.id || '').trim()
  return {
    ok: true,
    item: {
      ...(id ? { id } : {}),
      description,
      quantity,
      unit,
      rate: money2(rate),
      amount: calculateWeightLineItemAmount(quantity, unit, rate),
    },
  }
}

export function normalizeOtherServiceWeightLineItems(
  raw: OtherServiceLineItemInput[] | null | undefined,
): { ok: true; items: OtherServiceLineItem[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'At least one jewellery item is required' }
  }
  const items: OtherServiceLineItem[] = []
  for (let i = 0; i < raw.length; i++) {
    const one = normalizeOtherServiceWeightLineItem(raw[i], i)
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

export function totalWeightOf(
  items: Array<Pick<OtherServiceLineItem, 'quantity' | 'unit'>>,
): { quantity: number; unit: OtherServiceWeightUnit; label: string } {
  const weightItems = items.filter((item) => item.unit === 'GM' || item.unit === 'KG') as Array<{
    quantity: number
    unit: OtherServiceWeightUnit
  }>
  if (!weightItems.length) {
    return { quantity: 0, unit: 'GM', label: '0 g' }
  }
  const allGm = weightItems.every((item) => item.unit === 'GM')
  const allKg = weightItems.every((item) => item.unit === 'KG')
  if (allGm) {
    const quantity = money2(weightItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0))
    return { quantity, unit: 'GM', label: formatOtherServiceQuantity(quantity, 'GM') }
  }
  if (allKg) {
    const quantity = money2(weightItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0))
    return { quantity, unit: 'KG', label: formatOtherServiceQuantity(quantity, 'KG') }
  }
  const grams = money2(
    weightItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0
      return sum + (item.unit === 'KG' ? qty * 1000 : qty)
    }, 0),
  )
  if (grams >= 1000 && Math.abs(grams % 1000) < 0.0001) {
    const kg = money2(grams / 1000)
    return { quantity: kg, unit: 'KG', label: formatOtherServiceQuantity(kg, 'KG') }
  }
  return { quantity: grams, unit: 'GM', label: formatOtherServiceQuantity(grams, 'GM') }
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

  if (input.kind === 'weight' && input.items != null) {
    const normalized = normalizeOtherServiceWeightLineItems(input.items)
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
  if (input.kind === 'weight' && input.items == null && input.unit !== 'GM' && input.unit !== 'KG') {
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
  if (key.includes('laser')) return 'Laser Soldering'
  if (row.kind === 'manual' || key.includes('manual')) return 'Manual Services'
  if (
    key === UNIFIED_WEIGHT_SERVICE_NAME.toLowerCase() ||
    key.includes('silver polish / vibrat') ||
    isLegacyMergedWeightServiceName(name) ||
    key.includes('vibrator') ||
    key.includes('bravet') ||
    (key.includes('polish') && !key.includes('laser'))
  ) {
    return UNIFIED_WEIGHT_SERVICE_NAME
  }
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
  row: Pick<OtherService, 'kind' | 'item' | 'quantity' | 'rate' | 'totalAmount' | 'items' | 'unit'>,
): OtherServiceLineItem[] {
  if (Array.isArray(row.items) && row.items.length > 0) {
    const weightLike =
      row.kind === 'weight' || row.items.some((item) => item.unit === 'GM' || item.unit === 'KG')
    return row.items.map((item, index) => {
      if (weightLike) {
        const normalized = normalizeOtherServiceWeightLineItem(item, index)
        if (normalized.ok) return normalized.item
        const unit = parseWeightLineUnit(item.unit) || undefined
        return {
          description: lineItemDescriptionOf(item) || 'Item',
          quantity: Number(item.quantity) || 0,
          ...(unit ? { unit } : {}),
          rate: money2(lineItemRateOf(item)),
          amount: money2(
            item.amount ??
              (unit
                ? calculateWeightLineItemAmount(Number(item.quantity) || 0, unit, lineItemRateOf(item) || 0)
                : calculateLineItemAmount(Number(item.quantity) || 0, lineItemRateOf(item) || 0)),
          ),
        }
      }
      const normalized = normalizeOtherServiceLineItem(item, index)
      if (normalized.ok) return normalized.item
      return {
        description: lineItemDescriptionOf(item) || 'Item',
        quantity: Number(item.quantity) || 0,
        rate: money2(lineItemRateOf(item)),
        amount: money2(
          item.amount ?? calculateLineItemAmount(Number(item.quantity) || 0, lineItemRateOf(item) || 0),
        ),
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

export function formatOtherServiceLineQuantity(item: Pick<OtherServiceLineItem, 'quantity' | 'unit'>): string {
  if (item.unit === 'GM' || item.unit === 'KG') {
    return formatOtherServiceQuantity(item.quantity, item.unit)
  }
  return `${item.quantity} ${item.quantity === 1 ? 'pc' : 'pcs'}`
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
  if (row.kind === 'weight' && items.length) {
    const weight = totalWeightOf(items)
    return [
      ...items.map(
        (item) =>
          `${item.description} | ${formatOtherServiceLineQuantity(item)} | ${formatOtherServiceRate(item.rate, 'Per KG')} | ${item.amount}`,
      ),
      `Total Weight: ${weight.label}`,
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

/** Prefer an existing weight-service rate (Per KG) for new multi-item defaults. */
export function suggestDefaultWeightRatePerKg(
  services: Array<Pick<OtherService, 'kind' | 'status' | 'rate' | 'rateBasis' | 'items' | 'typeName' | 'typeId'>>,
): number | null {
  for (const row of services) {
    if (row.kind !== 'weight' || row.status === 'Cancelled') continue
    if (Array.isArray(row.items) && row.items.length) {
      for (const item of row.items) {
        const rate = Number(item.rate)
        if (Number.isFinite(rate) && rate > 0) return money2(rate)
      }
    }
    const rate = Number(row.rate)
    if (!Number.isFinite(rate) || rate <= 0) continue
    if (row.rateBasis === 'Per Gram') return money2(rate * 1000)
    return money2(rate)
  }
  return null
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

/** Fund ids referenced by Other Service rows in this store blob (tenant-local). */
export function getAuthoritativeOtherServiceFundIds(store: unknown): Set<string> {
  const data = asRecord(store)
  if (!data) return new Set()
  const rows = Array.isArray(data.otherServices) ? data.otherServices : []
  const ids = new Set<string>()
  for (const raw of rows) {
    const row = asRecord(raw)
    if (!row) continue
    const fundId = String(row.fundId || '').trim()
    if (fundId) ids.add(fundId)
  }
  return ids
}

export type OtherServiceFundIdentityResult =
  | { ok: true }
  | {
      ok: false
      status: 400
      error: string
      code: 'OS_FUND_IDENTITY_VIOLATION'
    }

function indexFundsById(rawFunds: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(rawFunds)) return map
  for (const raw of rawFunds) {
    const fund = asRecord(raw)
    if (!fund) continue
    const id = String(fund.id || '').trim()
    if (!id) continue
    map.set(id, fund)
  }
  return map
}

function indexOtherServicesByFundId(rawServices: unknown): Map<string, OtherService> {
  const map = new Map<string, OtherService>()
  if (!Array.isArray(rawServices)) return map
  for (const raw of rawServices) {
    const row = asRecord(raw)
    if (!row) continue
    const fundId = String(row.fundId || '').trim()
    if (!fundId) continue
    map.set(fundId, row as unknown as OtherService)
  }
  return map
}

function claimsClientOsMarkers(fund: Record<string, unknown>): boolean {
  return isOtherServiceFund({
    source: String(fund.source || ''),
    voucherNo: String(fund.voucherNo || ''),
  })
}

function applyLinkedOtherServiceFund(
  fund: Record<string, unknown>,
  linked: OtherService,
  previous: Record<string, unknown> | null,
) {
  fund.source = OTHER_SERVICE_FUND_SOURCE
  if ('partyName' in fund) delete fund.partyName
  if ('partyId' in fund) delete fund.partyId
  fund.amount = linked.amountReceived
  if (linked.receiptNo) fund.voucherNo = linked.receiptNo
  else if (previous && previous.voucherNo != null) fund.voucherNo = previous.voucherNo
  fund.remarks = otherServiceFundRemarks(linked)
  fund.mode = fundModeOf(linked.paymentMode)
}

/** Keep an unlinked-but-still-present former OS fund out of Hallmarking allocation. */
function forceOtherServiceIsolation(fund: Record<string, unknown>, previous: Record<string, unknown>) {
  fund.source = OTHER_SERVICE_FUND_SOURCE
  if ('partyName' in fund) delete fund.partyName
  if ('partyId' in fund) delete fund.partyId
  if (previous.voucherNo != null) fund.voucherNo = previous.voucherNo
  if (previous.amount != null) fund.amount = previous.amount
  if (previous.mode != null) fund.mode = previous.mode
  if (previous.remarks != null) fund.remarks = previous.remarks
}

/**
 * Server-authoritative Other Service fund identity for PUT /api/data/store.
 * Classification comes from otherServices[].fundId linkage (plus already-isolated
 * server funds), never from client-supplied source / RC-OS-* markers alone.
 */
export function enforceOtherServiceFundIdentity(opts: {
  currentStore: Record<string, unknown>
  nextStore: Record<string, unknown>
  replaceAll: boolean
}): OtherServiceFundIdentityResult {
  const { currentStore, nextStore, replaceAll } = opts
  const nextFundsRaw = Array.isArray(nextStore.funds) ? nextStore.funds : []
  const nextFunds = nextFundsRaw
    .map((raw) => asRecord(raw))
    .filter((f): f is Record<string, unknown> => Boolean(f))
  nextStore.funds = nextFunds

  const nextLinked = getAuthoritativeOtherServiceFundIds(nextStore)
  const nextOsByFundId = indexOtherServicesByFundId(nextStore.otherServices)
  const nextById = indexFundsById(nextFunds)

  if (replaceAll) {
    for (const fund of nextFunds) {
      const id = String(fund.id || '').trim()
      if (!id) continue
      const linked = nextOsByFundId.get(id)
      if (linked) {
        applyLinkedOtherServiceFund(fund, linked, null)
        continue
      }
      // Unlinked funds cannot establish OS identity from client markers alone.
      if (claimsClientOsMarkers(fund)) {
        fund.source = OTHER_SERVICE_FUND_SOURCE
        if ('partyName' in fund) delete fund.partyName
        if ('partyId' in fund) delete fund.partyId
      }
    }
    return { ok: true }
  }

  const serverFunds = indexFundsById(currentStore.funds)
  const serverLinked = getAuthoritativeOtherServiceFundIds(currentStore)
  const serverProtected = new Set<string>(serverLinked)
  for (const [id, fund] of serverFunds) {
    if (isOtherServiceFund({ source: String(fund.source || ''), voucherNo: String(fund.voucherNo || '') })) {
      serverProtected.add(id)
    }
  }

  for (const fundId of serverProtected) {
    const previous = serverFunds.get(fundId)
    if (!previous) continue
    const stillLinked = nextLinked.has(fundId)
    const incoming = nextById.get(fundId)

    if (stillLinked) {
      if (!incoming) {
        return {
          ok: false,
          status: 400,
          error: 'Other Service fund cannot be deleted while linked to an Other Service record',
          code: 'OS_FUND_IDENTITY_VIOLATION',
        }
      }
      const linked = nextOsByFundId.get(fundId)
      if (!linked) {
        return {
          ok: false,
          status: 400,
          error: 'Other Service fund linkage is invalid',
          code: 'OS_FUND_IDENTITY_VIOLATION',
        }
      }
      applyLinkedOtherServiceFund(incoming, linked, previous)
      continue
    }

    // Cancel / zero-payment unlinks fundId and removes the fund — allowed.
    if (!incoming) continue
    // Fund still present after unlink: keep it isolated from Hallmarking cash.
    forceOtherServiceIsolation(incoming, previous)
  }

  for (const fund of nextFunds) {
    const id = String(fund.id || '').trim()
    if (!id) continue
    if (serverProtected.has(id)) continue

    const onServer = serverFunds.has(id)
    const linked = nextLinked.has(id)

    if (!onServer && linked) {
      const linkedRow = nextOsByFundId.get(id)
      if (!linkedRow) {
        return {
          ok: false,
          status: 400,
          error: 'Other Service fund linkage is invalid',
          code: 'OS_FUND_IDENTITY_VIOLATION',
        }
      }
      applyLinkedOtherServiceFund(fund, linkedRow, null)
      continue
    }

    if (!onServer && !linked) {
      if (claimsClientOsMarkers(fund)) {
        return {
          ok: false,
          status: 400,
          error: 'Other Service fund requires a linked Other Service record',
          code: 'OS_FUND_IDENTITY_VIOLATION',
        }
      }
      continue
    }

    // Existing non-OS server fund.
    if (linked) {
      return {
        ok: false,
        status: 400,
        error: 'Cannot attach an existing Hallmarking fund to an Other Service record',
        code: 'OS_FUND_IDENTITY_VIOLATION',
      }
    }
    if (claimsClientOsMarkers(fund)) {
      return {
        ok: false,
        status: 400,
        error: 'Cannot relabel an existing Hallmarking fund as Other Service',
        code: 'OS_FUND_IDENTITY_VIOLATION',
      }
    }
  }

  return { ok: true }
}

/**
 * Recalculate Other Services totals on the server store blob.
 * Does not trust client-provided totalAmount / line amounts.
 * Does not convert stored gram quantities into kilograms.
 * Fund OS classification is applied only for rows linked via otherServices[].fundId;
 * client source / RC-OS-* markers alone are not authoritative (see enforceOtherServiceFundIdentity).
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
    // Preserve historical type names for legacy Vibrator / Silver Polish / Braveting rows.
    if (type?.name && !isLegacyMergedWeightServiceType(type)) {
      row.typeName = type.name
    } else if (type?.name && !row.typeName) {
      row.typeName = type.name
    }

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
      items:
        kind === 'piece' && itemsInput
          ? itemsInput
          : kind === 'weight' && itemsInput
            ? itemsInput
            : undefined,
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
    } else if (kind === 'weight' && itemsInput) {
      const normalized = normalizeOtherServiceWeightLineItems(itemsInput)
      if (!normalized.ok) {
        next.push(row)
        continue
      }
      row.items = normalized.items
      const weight = totalWeightOf(normalized.items)
      row.quantity = weight.quantity
      row.unit = weight.unit
      row.rateBasis = 'Per KG'
      row.item = summarizeOtherServiceItems(normalized.items)
      const rates = normalized.items.map((item) => item.rate)
      row.rate = rates.every((r) => r === rates[0]) ? rates[0] : money2(row.rate)
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

  // Only funds linked through otherServices[].fundId are OS-synced here.
  const funds = Array.isArray(data.funds) ? data.funds : []
  for (const fundRaw of funds) {
    const fund = asRecord(fundRaw)
    if (!fund) continue
    const fundId = String(fund.id || '').trim()
    if (!fundId) continue
    const linked = next.find((row) => row.fundId && row.fundId === fundId)
    if (!linked) continue
    applyLinkedOtherServiceFund(fund, linked, null)
  }
}
