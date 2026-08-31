/**
 * Monthly auto invoice numbering — start-from, month token, MAIN/OSC, OFP, duplicates.
 * Run: npx --yes tsx scripts/monthly-invoice-number.selftest.ts
 */
import {
  calendarMonthKey,
  formatInvoiceMonthToken,
  nextInvoiceNo,
  normalizeInvoiceBrandPrefix,
  normalizeInvoiceCenterType,
} from '../src/utils/documentNumbers.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`[monthly-invoice-number] ${msg}`)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `[monthly-invoice-number] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

// --- Month formatting (calendar-synced) ---
assertEq(formatInvoiceMonthToken('2026-08-15'), 'AUG', 'August → AUG')
assertEq(formatInvoiceMonthToken('2026-09-01'), 'SEP', 'September → SEP')
assertEq(formatInvoiceMonthToken('2026-10-31'), 'OCT', 'October → OCT')
assertEq(formatInvoiceMonthToken('2026-01-05'), 'JAN', 'January → JAN')
assertEq(calendarMonthKey('2026-08-15'), '2026-08', 'month key')
assertEq(normalizeInvoiceCenterType('osc'), 'OSC', 'center OSC')
assertEq(normalizeInvoiceCenterType('main'), 'MAIN', 'center MAIN')
assertEq(normalizeInvoiceBrandPrefix(''), 'SMG', 'empty brand → SMG')
assertEq(normalizeInvoiceBrandPrefix('SMG/'), 'SMG', 'trailing slash')
assertEq(normalizeInvoiceBrandPrefix('SMG/MAIN/AUG'), 'SMG', 'strips centre + month')
assertEq(normalizeInvoiceBrandPrefix('VH/'), 'VH', 'keeps custom brand')

// CASE 1 — August start from 1
{
  const a = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [],
    date: '2026-08-05',
    centerType: 'MAIN',
  })
  assertEq(a, 'SMG/MAIN/AUG/001', 'CASE 1 first')
  const b = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [{ invoiceNo: a, date: '2026-08-05' }],
    date: '2026-08-06',
    centerType: 'MAIN',
  })
  assertEq(b, 'SMG/MAIN/AUG/002', 'CASE 1 second')
  const c = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [
      { invoiceNo: a, date: '2026-08-05' },
      { invoiceNo: b, date: '2026-08-06' },
    ],
    date: '2026-08-07',
    centerType: 'MAIN',
  })
  assertEq(c, 'SMG/MAIN/AUG/003', 'CASE 1 third')
}

// CASE 2 / 5 — September resets without a stored month setting
{
  const august = [
    { invoiceNo: 'SMG/MAIN/AUG/001', date: '2026-08-05' },
    { invoiceNo: 'SMG/MAIN/AUG/002', date: '2026-08-06' },
    { invoiceNo: 'SMG/MAIN/AUG/003', date: '2026-08-07' },
  ]
  const sep = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: august,
    date: '2026-09-01',
    centerType: 'MAIN',
  })
  assertEq(sep, 'SMG/MAIN/SEP/001', 'CASE 2 September reset')
}

// CASE 3 — OSC independent of MAIN
{
  const mixed = [
    { invoiceNo: 'SMG/MAIN/AUG/001', date: '2026-08-05' },
    { invoiceNo: 'SMG/MAIN/AUG/002', date: '2026-08-06' },
  ]
  const osc1 = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: mixed,
    date: '2026-08-05',
    centerType: 'OSC',
  })
  assertEq(osc1, 'SMG/OSC/AUG/001', 'CASE 3 OSC first')
  const osc2 = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [...mixed, { invoiceNo: osc1, date: '2026-08-05' }],
    date: '2026-08-06',
    centerType: 'OSC',
  })
  assertEq(osc2, 'SMG/OSC/AUG/002', 'CASE 3 OSC second')
  const mainNext = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [...mixed, { invoiceNo: osc1, date: '2026-08-05' }, { invoiceNo: osc2, date: '2026-08-06' }],
    date: '2026-08-07',
    centerType: 'MAIN',
  })
  assertEq(mainNext, 'SMG/MAIN/AUG/003', 'CASE 3 MAIN sequence not shared with OSC')
}

// CASE 4 — Start From = 100
{
  const first = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 100,
    invoices: [],
    date: '2026-08-01',
    centerType: 'MAIN',
  })
  assertEq(first, 'SMG/MAIN/AUG/100', 'CASE 4 start 100')
  const next = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 100,
    invoices: [{ invoiceNo: first, date: '2026-08-01' }],
    date: '2026-08-02',
    centerType: 'MAIN',
  })
  assertEq(next, 'SMG/MAIN/AUG/101', 'CASE 4 next 101')
}

// CASE 6 — Historical invoices untouched
{
  const historical = { invoiceNo: 'INV-2026-001', date: '2026-08-01', operationalPeriod: '2026-27' }
  const snapshot = JSON.stringify(historical)
  const generated = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [historical],
    date: '2026-08-15',
    periodName: '2026-27',
    centerType: 'MAIN',
  })
  assertEq(generated, 'SMG/MAIN/AUG/001', 'CASE 6 new logic on new invoices')
  assertEq(historical.invoiceNo, 'INV-2026-001', 'CASE 6 historical number unchanged')
  assertEq(JSON.stringify(historical), snapshot, 'CASE 6 object not mutated')
}

// CASE 7 — Operational Financial Period isolation
{
  const in2026 = {
    invoiceNo: 'SMG/MAIN/AUG/001',
    date: '2026-08-10',
    operationalPeriod: '2026-27',
  }
  const next2025 = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [in2026],
    date: '2026-08-20',
    periodName: '2025-26',
    centerType: 'MAIN',
  })
  assertEq(next2025, 'SMG/MAIN/AUG/002', 'CASE 7 other OFP skips a globally used number')
  assertEq(in2026.invoiceNo, 'SMG/MAIN/AUG/001', 'CASE 7 stored number intact after OFP switch')
  const next2026 = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [in2026],
    date: '2026-08-20',
    periodName: '2026-27',
    centerType: 'MAIN',
  })
  assertEq(next2026, 'SMG/MAIN/AUG/002', 'CASE 7 working OFP continues')
}

// CASE 8 — Duplicate protection (max serial, not count; skip used numbers)
{
  const withGap = [
    { invoiceNo: 'SMG/MAIN/AUG/001', date: '2026-08-01' },
    { invoiceNo: 'SMG/MAIN/AUG/003', date: '2026-08-03' },
  ]
  const afterDelete = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: withGap,
    date: '2026-08-10',
    centerType: 'MAIN',
  })
  assertEq(afterDelete, 'SMG/MAIN/AUG/004', 'CASE 8 max serial not count (would be 003 if count-based)')

  const clash = [
    { invoiceNo: 'SMG/MAIN/AUG/001', date: '2025-08-01', operationalPeriod: '2025-26' },
  ]
  const skipped = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: clash,
    date: '2026-08-01',
    periodName: '2026-27',
    centerType: 'MAIN',
  })
  assertEq(skipped, 'SMG/MAIN/AUG/002', 'CASE 8 globally used number is skipped')
}

// CASE 9 — Reload / persistence: next number derived from stored invoices, not RAM-only counter
{
  const persisted = [
    { invoiceNo: 'SMG/MAIN/AUG/001', date: '2026-08-01', operationalPeriod: '2026-27' },
    { invoiceNo: 'SMG/MAIN/AUG/002', date: '2026-08-02', operationalPeriod: '2026-27' },
  ]
  const reload = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: persisted,
    date: '2026-08-20',
    periodName: '2026-27',
    centerType: 'MAIN',
  })
  assertEq(reload, 'SMG/MAIN/AUG/003', 'CASE 9 reload uses stored invoices')
}

// CASE 10 — Existing data still parses / does not block new numbers of another month
{
  const existing = [
    { invoiceNo: 'INV-2026-001', date: '2026-07-01' },
    { invoiceNo: '26-27/014', date: '2026-08-02' },
    { invoiceNo: 'SMG/MAIN/AUG/001', date: '2026-08-03' },
  ]
  const next = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: existing,
    date: '2026-08-20',
    centerType: 'MAIN',
  })
  assertEq(next, 'SMG/MAIN/AUG/002', 'CASE 10 existing mixed records still load; new serial continues')
  assert(
    existing.every((row) =>
      ['INV-2026-001', '26-27/014', 'SMG/MAIN/AUG/001'].includes(row.invoiceNo),
    ),
    'CASE 10 existing records not rewritten',
  )
}

// Credit notes never consume regular invoice serials
{
  const next = nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [{ invoiceNo: 'CN-26-27/1', date: '2026-08-01' }],
    date: '2026-08-01',
    centerType: 'MAIN',
  })
  assertEq(next, 'SMG/MAIN/AUG/001', 'credit notes excluded from invoice serial')
}

const seen = new Set<string>()
for (const n of [
  nextInvoiceNo({ prefix: 'SMG', startFrom: 1, invoices: [], date: '2026-08-01', centerType: 'MAIN' }),
  nextInvoiceNo({
    prefix: 'SMG',
    startFrom: 1,
    invoices: [{ invoiceNo: 'SMG/MAIN/AUG/001', date: '2026-08-01' }],
    date: '2026-08-02',
    centerType: 'MAIN',
  }),
  nextInvoiceNo({ prefix: 'SMG', startFrom: 1, invoices: [], date: '2026-08-01', centerType: 'OSC' }),
]) {
  assert(!seen.has(n), `unique among generated samples: ${n}`)
  seen.add(n)
}

console.log('[monthly-invoice-number] all cases passed')
