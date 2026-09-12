/**
 * Other Services — isolated numbering, calculations, Fund & Trace tagging.
 * Run: npx --yes tsx ./scripts/other-services.selftest.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calculateOtherServiceTotal,
  formatOtherServiceQuantity,
  hallmarkingFundVoucherCandidates,
  isOtherServiceFund,
  nextOtherServiceReceiptNo,
  nextOtherServiceSlipNo,
  normalizeOtherServiceLineItems,
  OTHER_SERVICE_FUND_SOURCE,
  otherServiceReceiptLines,
  pendingAmountOf,
  paymentStatusOf,
  reportBucketForService,
  sanitizeOtherServicesStorePayload,
  validateOtherServiceInput,
  type OtherService,
} from '../src/data/otherServices.ts'
import { computeInvoicePaymentStatuses, type FundEntry, type Invoice } from '../src/data/store.ts'
import { CENTRE_SCOPED_STORE_KEYS } from '../src/data/storeMerge.ts'
import {
  buildOtherServiceReceiptSlip,
  otherServiceReceiptBarcodeText,
} from '../src/utils/otherServiceReceiptPrint.ts'

function assertEq(actual: unknown, expected: unknown, label: string) {
  assert.equal(actual, expected, label)
}

const gm = calculateOtherServiceTotal({
  kind: 'weight',
  unit: 'GM',
  rateBasis: 'Per Gram',
  quantity: 125,
  rate: 3,
})
assert.equal(gm.ok, true)
if (gm.ok) assertEq(gm.total, 375, '125 GM × ₹3/GM')

const kg = calculateOtherServiceTotal({
  kind: 'weight',
  unit: 'KG',
  rateBasis: 'Per KG',
  quantity: 2,
  rate: 500,
})
assert.equal(kg.ok, true)
if (kg.ok) assertEq(kg.total, 1000, '2 KG × ₹500/KG')

const gmPerKg = calculateOtherServiceTotal({
  kind: 'weight',
  unit: 'GM',
  rateBasis: 'Per KG',
  quantity: 1000,
  rate: 500,
})
assert.equal(gmPerKg.ok, true, 'weight GM × Per KG converts only for calculation')
if (gmPerKg.ok) assertEq(gmPerKg.total, 500, '1000 g × ₹500/KG = ₹500')

const manualMismatch = calculateOtherServiceTotal({
  kind: 'manual',
  unit: 'GM',
  rateBasis: 'Per KG',
  quantity: 1000,
  rate: 500,
})
assert.equal(manualMismatch.ok, false, 'manual GM × Per KG must not silently convert')

const laser = calculateOtherServiceTotal({
  kind: 'piece',
  unit: 'Piece',
  rateBasis: 'Per Piece',
  quantity: 20,
  rate: 5,
})
assert.equal(laser.ok, true)
if (laser.ok) assertEq(laser.total, 100, '20 pieces × ₹5')

const notInt = calculateOtherServiceTotal({
  kind: 'piece',
  unit: 'Piece',
  rateBasis: 'Per Piece',
  quantity: 1.5,
  rate: 5,
})
assert.equal(notInt.ok, false, 'pieces must be a positive integer')

const tagFit = calculateOtherServiceTotal({
  kind: 'manual',
  unit: 'Piece',
  rateBasis: 'Per Piece',
  quantity: 20,
  rate: 5,
})
assert.equal(tagFit.ok, true)
if (tagFit.ok) assertEq(tagFit.total, 100, 'manual tag fitting')

const fixed = calculateOtherServiceTotal({
  kind: 'manual',
  unit: 'Fixed',
  rateBasis: 'Fixed',
  quantity: 0,
  rate: 250,
})
assert.equal(fixed.ok, true)
if (fixed.ok) assertEq(fixed.total, 250, 'fixed rate uses rate only')

assertEq(pendingAmountOf(500, 200), 300, 'pending = total - received')
assertEq(pendingAmountOf(500, 600), 0, 'pending never negative')
assertEq(paymentStatusOf(500, 0), 'Pending', 'zero received is pending')
assertEq(paymentStatusOf(500, 200), 'Partial', 'partial payment')
assertEq(paymentStatusOf(500, 500), 'Paid', 'full payment')

const contactErr = validateOtherServiceInput({
  typeId: 'os-type-vibrator',
  customerName: 'A',
  contactNo: '123',
  kind: 'weight',
  unit: 'GM',
  rateBasis: 'Per Gram',
  quantity: 10,
  rate: 2,
  amountReceived: 0,
})
assert.equal(Boolean(contactErr), true, 'contact must be 10 digits')

const overpay = validateOtherServiceInput({
  typeId: 'os-type-vibrator',
  customerName: 'A',
  contactNo: '9876543210',
  kind: 'weight',
  unit: 'GM',
  rateBasis: 'Per Gram',
  quantity: 10,
  rate: 2,
  amountReceived: 50,
})
assert.equal(Boolean(overpay), true, 'received cannot exceed total')

const vs1 = nextOtherServiceSlipNo('VS', [])
assertEq(vs1, 'VS-000001', 'first vibrator slip')
const vs2 = nextOtherServiceSlipNo('VS', [{ slipNo: 'VS-000001' }, { slipNo: 'LS-000001' }])
assertEq(vs2, 'VS-000002', 'vibrator sequence ignores laser slips')
const ms1 = nextOtherServiceSlipNo('MS', [{ slipNo: 'VS-000009' }])
assertEq(ms1, 'MS-000001', 'manual sequence is independent')

const rc1 = nextOtherServiceReceiptNo([], [], [])
assertEq(rc1, 'RC-OS-000001', 'first OS receipt')
const rc2 = nextOtherServiceReceiptNo(
  [{ receiptNo: 'RC-OS-000001' }],
  [{ receiptNo: 'RC-OS-000002' }],
  [{ voucherNo: 'RC-OS-000003', source: OTHER_SERVICE_FUND_SOURCE }],
)
assertEq(rc2, 'RC-OS-000004', 'receipt serial skips used numbers including funds')

assert.equal(isOtherServiceFund({ source: OTHER_SERVICE_FUND_SOURCE, voucherNo: '9' }), true)
assert.equal(isOtherServiceFund({ source: 'Rajesh Jewellers', voucherNo: 'RC-OS-000001' }), true)
assert.equal(isOtherServiceFund({ source: 'Rajesh Jewellers', voucherNo: '1' }), false)

const mixedFunds = [
  { source: 'Rajesh Jewellers', voucherNo: '1' },
  { source: OTHER_SERVICE_FUND_SOURCE, voucherNo: 'RC-OS-000001' },
  { source: 'Counter collection', voucherNo: '2' },
]
const hmOnly = hallmarkingFundVoucherCandidates(mixedFunds)
assert.equal(hmOnly.length, 2, 'OS funds excluded from HM voucher candidates')
assert.equal(
  hmOnly.some((f) => f.source === OTHER_SERVICE_FUND_SOURCE),
  false,
  'OTHER_SERVICE rows do not consume HM voucher serials',
)
assertEq(String(hmOnly.length + 1), '3', 'next HM voucher still 3 after an OS payment')

const invoices: Invoice[] = [
  {
    id: 'i1',
    invoiceNo: 'SMG/MAIN/SEP/001',
    partyName: 'Rajesh Jewellers',
    requestNo: 'HM-1',
    amount: 1000,
    tax: 0,
    total: 1000,
    status: 'Unpaid',
    date: '2026-09-12',
  },
]
const funds: FundEntry[] = [
  {
    id: 'f-os',
    date: '2026-09-12',
    source: OTHER_SERVICE_FUND_SOURCE,
    amount: 1000,
    mode: 'Cash',
    remarks: 'Silver Polish · VS-000001 · Rajesh Jewellers',
    voucherNo: 'RC-OS-000001',
  },
]
const statuses = computeInvoicePaymentStatuses(invoices, funds, 'Rajesh Jewellers')
assertEq(statuses.get('i1'), 'Unpaid', 'OS fund without matching partyName does not pay HM invoices')

assertEq(reportBucketForService({ typeName: 'Vibrator', kind: 'weight' }), 'Vibrator', 'vibrator bucket')
assertEq(reportBucketForService({ typeName: 'Silver Polish', kind: 'weight' }), 'Silver Polish', 'polish bucket')
assertEq(reportBucketForService({ typeName: 'Chain Cleaning', kind: 'manual' }), 'Manual Services', 'manual bucket')

assert.equal(CENTRE_SCOPED_STORE_KEYS.includes('otherServices'), true)
assert.equal(CENTRE_SCOPED_STORE_KEYS.includes('invoices'), true)

const root = path.dirname(fileURLToPath(import.meta.url))
const storeSrc = readFileSync(path.join(root, '../src/data/store.ts'), 'utf8')
assert.match(storeSrc, /!isOtherServiceFund\(f\)/, 'addFund ignores OTHER_SERVICE when numbering HM vouchers')
assert.match(storeSrc, /source: OTHER_SERVICE_FUND_SOURCE/, 'OS funds are tagged OTHER_SERVICE')
const insertFn = storeSrc.slice(
  storeSrc.indexOf('function insertOtherServiceFund'),
  storeSrc.indexOf('function syncOtherServiceFund'),
)
assert.equal(insertFn.includes('applyInvoicePaymentStatuses'), false, 'OS fund insert does not touch HM invoice status')

const dataRoute = readFileSync(path.join(root, '../server/src/routes/data.ts'), 'utf8')
assert.match(dataRoute, /sanitizeOtherServicesStorePayload/, 'PUT /store sanitizes Other Services totals on the server')

const laserItems = normalizeOtherServiceLineItems([
  { description: 'Hair', quantity: 2, rate: 50, amount: 999 },
  { description: 'Locket', quantity: 3, rate: 40, amount: 1 },
])
assert.equal(laserItems.ok, true, 'laser items normalize')
if (laserItems.ok) {
  assertEq(laserItems.items.length, 2, 'multiple items in one record')
  assertEq(laserItems.items[0].amount, 100, 'Hair 2 × ₹50')
  assertEq(laserItems.items[1].amount, 120, 'Locket 3 × ₹40')
  assert.notEqual(laserItems.items[0].amount, 999, 'client line amount is not trusted')
}

const laserTotal = calculateOtherServiceTotal({
  kind: 'piece',
  unit: 'Piece',
  rateBasis: 'Per Piece',
  quantity: 0,
  rate: 0,
  items: [
    { description: 'Hair', quantity: 2, rate: 50 },
    { description: 'Locket', quantity: 3, rate: 40 },
  ],
})
assert.equal(laserTotal.ok, true)
if (laserTotal.ok) assertEq(laserTotal.total, 220, 'laser Hair+Locket total ₹220')

const laserEdited = normalizeOtherServiceLineItems([
  { description: 'Hair', quantity: 2, rate: 50 },
])
assert.equal(laserEdited.ok, true, 'removing a line item leaves the rest')
if (laserEdited.ok) assertEq(laserEdited.items.length, 1, 'one item after remove')

const laserReceipt = otherServiceReceiptLines({
  kind: 'piece',
  typeName: 'Laser Soldering',
  item: 'Hair, Locket',
  productDescription: '',
  quantity: 5,
  unit: 'Piece',
  rate: 0,
  rateBasis: 'Per Piece',
  totalAmount: 220,
  items: [
    { description: 'Hair', quantity: 2, rate: 50, amount: 100 },
    { description: 'Locket', quantity: 3, rate: 40, amount: 120 },
  ],
})
assert.equal(laserReceipt.some((line) => line.includes('Hair') && line.includes('2 pcs')), true, 'receipt lists Hair')
assert.equal(laserReceipt.some((line) => line.includes('Locket') && line.includes('3 pcs')), true, 'receipt lists Locket')
assert.equal(laserReceipt.some((line) => line.includes('Total') && line.includes('220')), true, 'receipt lists total')

const vibKg = calculateOtherServiceTotal({
  kind: 'weight',
  unit: 'KG',
  rateBasis: 'Per KG',
  quantity: 1,
  rate: 1000,
})
assert.equal(vibKg.ok, true)
if (vibKg.ok) assertEq(vibKg.total, 1000, '1 KG × ₹1000')

const vib500g = calculateOtherServiceTotal({
  kind: 'weight',
  unit: 'GM',
  rateBasis: 'Per KG',
  quantity: 500,
  rate: 1000,
})
assert.equal(vib500g.ok, true)
if (vib500g.ok) assertEq(vib500g.total, 500, '500 g × ₹1000/kg')

const vib250g = calculateOtherServiceTotal({
  kind: 'weight',
  unit: 'GM',
  rateBasis: 'Per KG',
  quantity: 250,
  rate: 1000,
})
assert.equal(vib250g.ok, true)
if (vib250g.ok) assertEq(vib250g.total, 250, '250 g × ₹1000/kg')

assertEq(formatOtherServiceQuantity(500, 'GM'), '500 g', 'display keeps grams')
assert.equal(formatOtherServiceQuantity(500, 'GM').toLowerCase().includes('kg'), false, 'grams are not shown as KG')
assertEq(formatOtherServiceQuantity(2, 'KG'), '2 KG', 'kg display stays KG')

const polishKg = calculateOtherServiceTotal({
  kind: 'weight',
  unit: 'KG',
  rateBasis: 'Per KG',
  quantity: 2,
  rate: 800,
})
assert.equal(polishKg.ok, true)
if (polishKg.ok) assertEq(polishKg.total, 1600, '2 KG × ₹800')

const polish500g = calculateOtherServiceTotal({
  kind: 'weight',
  unit: 'GM',
  rateBasis: 'Per KG',
  quantity: 500,
  rate: 800,
})
assert.equal(polish500g.ok, true)
if (polish500g.ok) assertEq(polish500g.total, 400, '500 g × ₹800/kg')

const vibReceipt = otherServiceReceiptLines({
  kind: 'weight',
  typeName: 'Vibrator',
  item: '',
  productDescription: '',
  quantity: 500,
  unit: 'GM',
  rate: 1000,
  rateBasis: 'Per KG',
  totalAmount: 500,
})
assert.equal(vibReceipt.some((line) => line.includes('500 g')), true, 'receipt keeps 500 g')
assert.equal(vibReceipt.some((line) => line.includes('/ KG')), true, 'receipt shows per KG rate')
assert.equal(vibReceipt.join(' ').includes('0.5 KG'), false, 'receipt does not convert 500 g to 0.5 KG')

assert.equal(
  Boolean(
    validateOtherServiceInput({
      typeId: 'os-type-laser',
      customerName: 'A',
      contactNo: '9876543210',
      kind: 'piece',
      unit: 'Piece',
      rateBasis: 'Per Piece',
      quantity: 0,
      rate: 0,
      amountReceived: 0,
      items: [],
    }),
  ),
  true,
  'missing laser items rejected',
)
assert.equal(
  Boolean(
    validateOtherServiceInput({
      typeId: 'os-type-laser',
      customerName: 'A',
      contactNo: '9876543210',
      kind: 'piece',
      unit: 'Piece',
      rateBasis: 'Per Piece',
      quantity: 0,
      rate: 0,
      amountReceived: 0,
      items: [{ description: '', quantity: 2, rate: 50 }],
    }),
  ),
  true,
  'empty item description rejected',
)
assert.equal(
  Boolean(
    validateOtherServiceInput({
      typeId: 'os-type-vibrator',
      customerName: 'A',
      contactNo: '9876543210',
      kind: 'weight',
      unit: 'GM',
      rateBasis: 'Per KG',
      quantity: -1,
      rate: 1000,
      amountReceived: 0,
    }),
  ),
  true,
  'negative quantity rejected',
)
assert.equal(
  Boolean(
    validateOtherServiceInput({
      typeId: 'os-type-vibrator',
      customerName: 'A',
      contactNo: '9876543210',
      kind: 'weight',
      unit: 'GM',
      rateBasis: 'Per KG',
      quantity: 500,
      rate: -10,
      amountReceived: 0,
    }),
  ),
  true,
  'negative rate rejected',
)
assert.equal(
  Boolean(
    validateOtherServiceInput({
      typeId: 'os-type-vibrator',
      customerName: 'A',
      contactNo: '9876543210',
      kind: 'weight',
      unit: 'Piece',
      rateBasis: 'Per KG',
      quantity: 1,
      rate: 1000,
      amountReceived: 0,
    }),
  ),
  true,
  'invalid unit rejected',
)

const tampered = {
  otherServiceTypes: [],
  otherServices: [
    {
      id: 'os1',
      typeId: 'os-type-laser',
      typeName: 'Laser Soldering',
      kind: 'piece',
      unit: 'Piece',
      rateBasis: 'Per Piece',
      quantity: 99,
      rate: 1,
      totalAmount: 99999,
      amountReceived: 10,
      pendingAmount: 0,
      paymentMode: 'Cash',
      paymentStatus: 'Paid',
      item: '',
      customerName: 'A',
      contactNo: '9876543210',
      items: [
        { description: 'Hair', quantity: 2, rate: 50, amount: 1 },
        { description: 'Locket', quantity: 3, rate: 40, amount: 1 },
      ],
    },
    {
      id: 'os2',
      typeId: 'os-type-vibrator',
      typeName: 'Vibrator',
      kind: 'weight',
      unit: 'GM',
      rateBasis: 'Per KG',
      quantity: 500,
      rate: 1000,
      totalAmount: 99999,
      amountReceived: 0,
      pendingAmount: 0,
      paymentMode: 'Cash',
      paymentStatus: 'Pending',
      item: '',
      customerName: 'B',
      contactNo: '9876543210',
    },
  ],
  funds: [
    {
      id: 'f-hm',
      source: 'Rajesh Jewellers',
      voucherNo: '1',
      amount: 700,
    },
    {
      id: 'f-os',
      source: OTHER_SERVICE_FUND_SOURCE,
      voucherNo: 'RC-OS-000001',
      amount: 10,
    },
  ],
} as Record<string, unknown>
;(tampered.otherServices as Array<Record<string, unknown>>)[0].fundId = 'f-os'
sanitizeOtherServicesStorePayload(tampered)
const sanitized = tampered.otherServices as Array<Record<string, unknown>>
assertEq(sanitized[0].totalAmount, 220, 'server recalculates tampered laser total')
assertEq(sanitized[0].quantity, 5, 'laser quantity is sum of pieces')
assertEq(sanitized[1].totalAmount, 500, 'server recalculates tampered vibrator total')
assertEq(sanitized[1].quantity, 500, 'vibrator quantity stays 500')
assertEq(sanitized[1].unit, 'GM', 'vibrator unit stays Gram')
const fundsOut = tampered.funds as Array<Record<string, unknown>>
assertEq(fundsOut[0].amount, 700, 'Hallmarking fund amount is untouched')
assertEq(fundsOut[1].amount, 10, 'linked OS fund follows received amount')

const legacyGram = {
  otherServices: [
    {
      id: 'os-legacy',
      typeId: 'os-type-vibrator',
      typeName: 'Vibrator',
      kind: 'weight',
      unit: 'GM',
      rateBasis: 'Per Gram',
      quantity: 125,
      rate: 3,
      totalAmount: 375,
      amountReceived: 375,
      pendingAmount: 0,
      paymentMode: 'Cash',
      paymentStatus: 'Paid',
      item: '',
      customerName: 'Legacy',
      contactNo: '9876543210',
    },
  ],
} as Record<string, unknown>
sanitizeOtherServicesStorePayload(legacyGram)
const legacyRow = (legacyGram.otherServices as Array<Record<string, unknown>>)[0]
assertEq(legacyRow.totalAmount, 375, 'legacy Per Gram records keep qty × rate')
assertEq(legacyRow.unit, 'GM', 'legacy unit unchanged')
assertEq(legacyRow.quantity, 125, 'legacy quantity unchanged')
assertEq(legacyRow.rateBasis, 'Per Gram', 'legacy rate basis unchanged')

const fundEntry = readFileSync(path.join(root, '../src/pages/FundEntry.tsx'), 'utf8')
assert.match(fundEntry, /export function FundEntry/, 'Fund Entry UI file still present')
const billing = readFileSync(path.join(root, '../src/pages/Billing.tsx'), 'utf8')
assert.match(billing, /export function Billing/, 'Billing page still present')

const modalSrc = readFileSync(path.join(root, '../src/components/PaymentSuccessReceiptModal.tsx'), 'utf8')
const modalCss = readFileSync(path.join(root, '../src/components/PaymentSuccessReceiptModal.css'), 'utf8')
const entrySrc = readFileSync(path.join(root, '../src/pages/other-services/NewServiceEntry.tsx'), 'utf8')
assert.match(entrySrc, /PaymentSuccessReceiptModal/, 'save flow opens the receipt animation modal')
assert.match(entrySrc, /setReceiptService\(result\.service\)/, 'animation uses the saved service record')
const submitSrc = entrySrc.slice(entrySrc.indexOf('const submit ='), entrySrc.indexOf('const printSavedReceipt'))
assert.equal(submitSrc.includes('openOtherServiceReceiptPrint'), false, 'save does not print before the animation')
assert.equal(submitSrc.includes('addFund('), false, 'save handler does not call addFund')
assert.match(entrySrc, /openOtherServiceReceiptPrint\(receiptService/, 'Print Again reprints the saved receipt')
assert.equal(modalSrc.includes('addFund('), false, 'animation does not call addFund')
assert.equal(modalSrc.includes('addOtherService('), false, 'animation does not save another service')
assert.equal(modalSrc.includes('insertOtherServiceFund'), false, 'animation does not insert a fund')
assert.equal(modalSrc.includes('markOtherServiceReceiptPrinted'), false, 'animation does not mint another receipt')
assert.match(modalCss, /translateY\(-70%\)/, 'paper starts tucked inside the printer')
assert.match(modalCss, /overflow:\s*hidden/, 'paper is clipped as it leaves the slot')
assert.match(modalCss, /prefers-reduced-motion/, 'reduced motion shows the finished receipt')

const laserSlip = buildOtherServiceReceiptSlip({
  id: 'os-anim-laser',
  slipNo: 'LS-000001',
  typeId: 'os-type-laser',
  typeName: 'Laser Soldering',
  kind: 'piece',
  customerName: 'Kalyan Jewellers',
  address: '',
  contactNo: '9876543210',
  date: '2026-09-13',
  dateTime: '2026-09-13T12:29:00',
  unit: 'Piece',
  quantity: 6,
  rate: 0,
  rateBasis: 'Per Piece',
  totalAmount: 270,
  amountReceived: 270,
  pendingAmount: 0,
  paymentMode: 'Cash',
  paymentStatus: 'Paid',
  item: 'Hair, Locket, Ring',
  productDescription: '',
  remark: '',
  receiptNo: 'RC-OS-000123',
  items: [
    { description: 'Hair', quantity: 2, rate: 50, amount: 100 },
    { description: 'Locket', quantity: 3, rate: 40, amount: 120 },
    { description: 'Ring', quantity: 1, rate: 50, amount: 50 },
  ],
  status: 'Open',
  createdAt: '2026-09-13T12:29:00',
  updatedAt: '2026-09-13T12:29:00',
  createdBy: 'user',
  updatedBy: 'user',
} as OtherService)
assertEq(laserSlip.receiptNo, 'RC-OS-000123', 'animation uses the real receipt number')
assertEq(laserSlip.customerName, 'Kalyan Jewellers', 'animation uses the saved customer')
assertEq(laserSlip.serviceName, 'Laser Soldering', 'animation uses the saved service name')
assert.equal(laserSlip.totalAmount.includes('270'), true, 'animation uses the saved total')
assertEq(laserSlip.itemRows.length, 3, 'laser animation lists item rows')
assert.equal(
  laserSlip.itemRows.some((row) => row.description === 'Hair' && row.quantity === '2'),
  true,
  'laser animation lists Hair qty',
)
assertEq(otherServiceReceiptBarcodeText(laserSlip.receiptNo), 'RCOS000123', 'barcode uses the issued receipt number')

const vibSlip = buildOtherServiceReceiptSlip({
  id: 'os-anim-vib',
  slipNo: 'VS-000001',
  typeId: 'os-type-vibrator',
  typeName: 'Vibrator',
  kind: 'weight',
  customerName: 'Rajesh Jewellers',
  address: '',
  contactNo: '9876543210',
  date: '2026-09-13',
  dateTime: '2026-09-13T12:29:00',
  unit: 'GM',
  quantity: 500,
  rate: 1000,
  rateBasis: 'Per KG',
  totalAmount: 500,
  amountReceived: 500,
  pendingAmount: 0,
  paymentMode: 'Cash',
  paymentStatus: 'Paid',
  item: '',
  productDescription: '',
  remark: '',
  receiptNo: 'RC-OS-000124',
  status: 'Open',
  createdAt: '2026-09-13T12:29:00',
  updatedAt: '2026-09-13T12:29:00',
  createdBy: 'user',
  updatedBy: 'user',
} as OtherService)
assert.equal(vibSlip.facts.some((f) => f.label === 'Weight' && f.value === '500 g'), true, 'vibrator animation keeps grams')
assert.equal(vibSlip.facts.some((f) => f.label === 'Rate' && f.value.includes('/ KG')), true, 'vibrator animation shows per KG')
assert.equal(vibSlip.facts.join(' ').includes('0.5 KG'), false, 'vibrator animation does not convert grams to KG')

const polishSlip = buildOtherServiceReceiptSlip({
  id: 'os-anim-polish',
  slipNo: 'VS-000002',
  typeId: 'os-type-silver-polish',
  typeName: 'Silver Polish',
  kind: 'weight',
  customerName: 'Mehta Jewellers',
  address: '',
  contactNo: '9876543210',
  date: '2026-09-13',
  dateTime: '2026-09-13T12:29:00',
  unit: 'KG',
  quantity: 2,
  rate: 1000,
  rateBasis: 'Per KG',
  totalAmount: 2000,
  amountReceived: 2000,
  pendingAmount: 0,
  paymentMode: 'UPI',
  paymentStatus: 'Paid',
  item: '',
  productDescription: '',
  remark: '',
  receiptNo: 'RC-OS-000125',
  status: 'Open',
  createdAt: '2026-09-13T12:29:00',
  updatedAt: '2026-09-13T12:29:00',
  createdBy: 'user',
  updatedBy: 'user',
} as OtherService)
assert.equal(polishSlip.facts.some((f) => f.value === '2 KG'), true, 'silver polish animation keeps KG')
assert.equal(polishSlip.totalAmount.includes('2,000') || polishSlip.totalAmount.includes('2000'), true, 'silver polish uses saved amount')

console.log('other-services.selftest.ts: ok')
