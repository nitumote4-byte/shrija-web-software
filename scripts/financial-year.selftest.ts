/**
 * Indian Financial Year + FY-aware document numbering.
 * Run: npx --yes tsx scripts/financial-year.selftest.ts
 */
import {
  formatFySequence,
  nextCreditNoteNo,
  nextInvoiceNo,
  nextKeyedDocumentNo,
  nextMonthlyInvoiceNo,
  prefixIncludesYearToken,
} from '../src/utils/documentNumbers.ts'
import {
  getFinancialYear,
  getFinancialYearEnd,
  getFinancialYearLabel,
  getFinancialYearMonthBuckets,
  getFinancialYearShort,
  getFinancialYearStart,
  getFinancialYearStartYear,
} from '../src/utils/financialYear.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`[financial-year] ${msg}`)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `[financial-year] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

// --- Boundary dates ---
assertEq(getFinancialYear('2026-03-31'), '2025-26', '31 Mar 2026 → 2025-26')
assertEq(getFinancialYear('2026-04-01'), '2026-27', '1 Apr 2026 → 2026-27')
assertEq(getFinancialYearStart('2026-03-31'), '2025-04-01', 'FY start for Mar')
assertEq(getFinancialYearEnd('2026-03-31'), '2026-03-31', 'FY end for Mar')
assertEq(getFinancialYearStart('2026-04-01'), '2026-04-01', 'FY start for Apr')
assertEq(getFinancialYearEnd('2026-04-01'), '2027-03-31', 'FY end for Apr')
assertEq(getFinancialYearLabel('2026-04-01'), 'FY 2026-27', 'label')
assertEq(getFinancialYearShort('2026-04-01'), '26-27', 'short Apr')
assertEq(getFinancialYearShort('2026-03-31'), '25-26', 'short Mar')

// --- Month samples ---
assertEq(getFinancialYear('2026-01-15'), '2025-26', 'January')
assertEq(getFinancialYear('2026-02-10'), '2025-26', 'February')
assertEq(getFinancialYear('2026-03-01'), '2025-26', 'March')
assertEq(getFinancialYear('2026-04-15'), '2026-27', 'April')
assertEq(getFinancialYear('2026-12-31'), '2026-27', 'December')
assertEq(getFinancialYearStartYear('2027-01-15'), 2026, 'Jan start year')

// --- Historical date vs "today" ---
{
  const march = '2026-03-15'
  const august = '2026-08-15'
  assertEq(getFinancialYear(march), '2025-26', 'historical March FY')
  assertEq(getFinancialYear(august), '2026-27', 'August current FY')
  assert(
    getFinancialYear(march) !== getFinancialYear(august),
    'March invoice stays in prior FY even when "today" is August',
  )
}

// --- Month buckets Apr→Mar ---
{
  const buckets = getFinancialYearMonthBuckets('2026-08-01')
  assertEq(buckets.length, 12, '12 FY months')
  assertEq(buckets[0].label, 'Apr', 'first bucket Apr')
  assertEq(buckets[0].year, 2026, 'Apr year')
  assertEq(buckets[11].label, 'Mar', 'last bucket Mar')
  assertEq(buckets[11].year, 2027, 'Mar year')
}

// --- Invoice numbering per FY ---
{
  const fyA = [
    { invoiceNo: '25-26/001', date: '2025-04-10' },
    { invoiceNo: '25-26/002', date: '2025-09-01' },
    { invoiceNo: '25-26/003', date: '2026-03-20' },
  ]
  const n1 = nextInvoiceNo({ prefix: '', startFrom: 1, invoices: fyA, date: '2026-03-31' })
  assertEq(n1, '25-26/004', 'continues within FY 2025-26')

  const n2 = nextInvoiceNo({ prefix: '', startFrom: 1, invoices: fyA, date: '2026-04-01' })
  assertEq(n2, '26-27/001', 'resets on new FY 2026-27')

  const n3 = nextInvoiceNo({
    prefix: 'VH/',
    startFrom: 1,
    invoices: [{ invoiceNo: 'VH/26-27/001', date: '2026-05-01' }],
    date: '2026-06-01',
  })
  assertEq(n3, 'VH/26-27/002', 'prefix + FY short')

  assert(prefixIncludesYearToken('VH/2024/'), 'detects calendar year in prefix')
  assert(prefixIncludesYearToken('VH/26-27/'), 'detects FY short in prefix')
  assertEq(
    formatFySequence('VH/2024/', '26-27', 5),
    'VH/2024/005',
    'does not duplicate year when prefix already has one',
  )
}

// --- Monthly billing period → FY ---
{
  assertEq(
    nextMonthlyInvoiceNo({
      prefix: '',
      startFrom: 1,
      monthlyInvoices: [],
      date: '2026-03-15',
    }),
    'M-25-26/001',
    'March period → FY 2025-26',
  )
  assertEq(
    nextMonthlyInvoiceNo({
      prefix: '',
      startFrom: 1,
      monthlyInvoices: [{ invoiceNo: 'M-25-26/001', date: '2026-03-15' }],
      date: '2026-03-20',
    }),
    'M-25-26/002',
    'March sequence continues',
  )
  assertEq(
    nextMonthlyInvoiceNo({
      prefix: '',
      startFrom: 1,
      monthlyInvoices: [{ invoiceNo: 'M-25-26/001', date: '2026-03-15' }],
      date: '2026-04-01',
    }),
    'M-26-27/001',
    'April period → FY 2026-27 reset',
  )
}

// --- Keyed document fallback ---
{
  const hm = nextKeyedDocumentNo({
    key: 'HM',
    existing: [{ no: 'HM-2026-001', date: '2026-07-01' }],
    date: '2026-08-01',
  })
  assertEq(hm, 'HM-26-27-002', 'HM uses FY short + count in FY')

  const hmNewFy = nextKeyedDocumentNo({
    key: 'HM',
    existing: [{ no: 'HM-2026-001', date: '2026-03-01' }],
    date: '2026-04-01',
  })
  assertEq(hmNewFy, 'HM-26-27-001', 'HM resets in new FY')
}

// ============================================================================
// Regression: audit gaps
// ============================================================================

// 1. Historical invoice number preservation
{
  const historical = { invoiceNo: 'INV-2026-001', date: '2026-07-01', amount: 1000 }
  const snapshot = JSON.parse(JSON.stringify(historical)) as typeof historical

  const generated = nextInvoiceNo({
    prefix: 'INV-',
    startFrom: 1,
    invoices: [historical],
    date: '2026-08-01',
  })

  assertEq(generated, 'INV-26-27/002', 'historical invoice preserved — next FY-aware number')
  assertEq(historical.invoiceNo, 'INV-2026-001', 'historical invoice preserved — invoiceNo unchanged')
  assertEq(historical.date, '2026-07-01', 'historical invoice preserved — date unchanged')
  assertEq(
    JSON.stringify(historical),
    JSON.stringify(snapshot),
    'historical invoice preserved — object not mutated',
  )

  // Simulate ViewGeneratedBills / store.updateInvoice path: patch omits invoiceNo
  const edited = { ...historical }
  Object.assign(edited, {
    amount: 1500,
    tax: 270,
    total: 1770,
    updatedAt: '2026-08-15T10:00:00.000Z',
  })
  assertEq(edited.invoiceNo, 'INV-2026-001', 'historical invoice preserved — edit without invoiceNo')
  assertEq(edited.amount, 1500, 'historical invoice preserved — other fields still update')
  console.log('[financial-year] historical invoice preserved')
}

// 2. Legacy credit notes without date — must not pollute FY 2026-27
{
  const legacyNoDate = [
    { cnNo: 'CN-1' },
    { cnNo: 'CN-25' },
    { cnNo: 'CN-100' },
  ]
  const next = nextCreditNoteNo({
    existing: legacyNoDate,
    monthOrDate: '2026-04',
  })
  assertEq(next, 'CN-26-27/1', 'legacy CN without date ignored')
  assert(next !== 'CN-26-27/2', 'legacy CN without date ignored — not /2')
  assert(next !== 'CN-26-27/26', 'legacy CN without date ignored — not /26')
  assert(next !== 'CN-26-27/101', 'legacy CN without date ignored — not /101')
  console.log('[financial-year] legacy CN without date ignored')
}

// 3. Legacy credit note with date in target FY
{
  const next = nextCreditNoteNo({
    existing: [{ cnNo: 'CN-100', date: '2026-05-01' }],
    monthOrDate: '2026-04',
  })
  assertEq(next, 'CN-26-27/101', 'legacy CN in FY counted')
  console.log('[financial-year] legacy CN in FY counted')
}

// 4. Legacy credit note with date in previous FY
{
  const next = nextCreditNoteNo({
    existing: [{ cnNo: 'CN-100', date: '2026-03-01' }],
    monthOrDate: '2026-04',
  })
  assertEq(next, 'CN-26-27/1', 'legacy CN previous FY ignored')
  console.log('[financial-year] legacy CN previous FY ignored')
}

// 5. FY-aware credit note sequence
{
  const nextSameFy = nextCreditNoteNo({
    existing: [
      { cnNo: 'CN-26-27/1', month: '2026-05' },
      { cnNo: 'CN-26-27/005', month: '2026-06' },
      { cnNo: 'CN-26-27/12', month: '2026-07' },
    ],
    monthOrDate: '2026-08',
  })
  assertEq(nextSameFy, 'CN-26-27/13', 'FY-aware CN sequence continues')

  const nextOtherFy = nextCreditNoteNo({
    existing: [{ cnNo: 'CN-25-26/005', month: '2026-03' }],
    monthOrDate: '2026-04',
  })
  assertEq(nextOtherFy, 'CN-26-27/1', 'FY-aware CN other-FY does not inflate')
  console.log('[financial-year] FY-aware CN sequence continues')
}

// 6. FY reset — invoices, monthly, credit notes start independently
{
  const priorInvoices = [
    { invoiceNo: '25-26/001', date: '2025-04-10' },
    { invoiceNo: '25-26/002', date: '2025-09-01' },
    { invoiceNo: '25-26/003', date: '2026-03-20' },
  ]
  const priorMonthly = [
    { invoiceNo: 'M-25-26/001', date: '2025-05-01' },
    { invoiceNo: 'M-25-26/002', date: '2026-03-15' },
  ]
  const priorCn = [
    { cnNo: 'CN-25-26/1', month: '2025-06' },
    { cnNo: 'CN-25-26/9', month: '2026-03' },
  ]
  const priorSnapshot = JSON.stringify({ priorInvoices, priorMonthly, priorCn })

  const invNew = nextInvoiceNo({
    prefix: '',
    startFrom: 1,
    invoices: priorInvoices,
    date: '2026-04-01',
  })
  const monNew = nextMonthlyInvoiceNo({
    prefix: '',
    startFrom: 1,
    monthlyInvoices: priorMonthly,
    date: '2026-04-01',
  })
  const cnNew = nextCreditNoteNo({
    existing: priorCn,
    monthOrDate: '2026-04',
  })

  assertEq(invNew, '26-27/001', 'FY reset works — invoice')
  assertEq(monNew, 'M-26-27/001', 'FY reset works — monthly')
  assertEq(cnNew, 'CN-26-27/1', 'FY reset works — credit note')
  assertEq(
    JSON.stringify({ priorInvoices, priorMonthly, priorCn }),
    priorSnapshot,
    'FY reset works — prior FY documents not renumbered',
  )
  console.log('[financial-year] FY reset works')
}

// 7. Historical date must determine FY (not "today")
{
  assertEq(getFinancialYear('2026-03-31'), '2025-26', 'historical date determines FY — 31 Mar')
  assertEq(getFinancialYear('2026-04-01'), '2026-27', 'historical date determines FY — 1 Apr')

  // March 2026 doc counted in 2025-26 even when classifying against an August "system" date context
  const marchDoc = { invoiceNo: '25-26/001', date: '2026-03-15' }
  const augustContext = '2026-08-15'
  assertEq(getFinancialYear(augustContext), '2026-27', 'historical date determines FY — Aug is 26-27')
  assertEq(getFinancialYear(marchDoc.date), '2025-26', 'historical date determines FY — Mar doc is 25-26')

  const nextInMarchFy = nextInvoiceNo({
    prefix: '',
    startFrom: 1,
    invoices: [marchDoc],
    date: '2026-03-31',
  })
  assertEq(nextInMarchFy, '25-26/002', 'historical date determines FY — counted in 25-26')

  const nextInAprilFy = nextInvoiceNo({
    prefix: '',
    startFrom: 1,
    invoices: [marchDoc],
    date: '2026-04-01',
  })
  assertEq(nextInAprilFy, '26-27/001', 'historical date determines FY — not counted in 26-27')
  assertEq(marchDoc.invoiceNo, '25-26/001', 'historical date determines FY — march doc number intact')
  console.log('[financial-year] historical date determines FY')
}

// 8. Malformed FY-looking CN numbers must not inflate sequence
{
  assertEq(
    nextCreditNoteNo({
      existing: [{ cnNo: 'CN-25-26', date: '2026-05-01' }],
      monthOrDate: '2026-04',
    }),
    'CN-26-27/1',
    'malformed CN-25-26 dated in FY ignored',
  )

  assertEq(
    nextCreditNoteNo({
      existing: [{ cnNo: 'CN-26-27', date: '2026-05-01' }],
      monthOrDate: '2026-04',
    }),
    'CN-26-27/1',
    'malformed CN-26-27 dated in FY ignored',
  )

  assertEq(
    nextCreditNoteNo({
      existing: [{ cnNo: 'CN-25-26-ABC', date: '2026-05-01' }],
      monthOrDate: '2026-04',
    }),
    'CN-26-27/1',
    'malformed CN-25-26-ABC dated in FY ignored',
  )

  assertEq(
    nextCreditNoteNo({
      existing: [{ cnNo: 'CN-26-27/005', month: '2026-05' }],
      monthOrDate: '2026-04',
    }),
    'CN-26-27/6',
    'valid FY-aware CN-26-27/005 continues',
  )

  assertEq(
    nextCreditNoteNo({
      existing: [{ cnNo: 'CN-100', date: '2026-05-01' }],
      monthOrDate: '2026-04',
    }),
    'CN-26-27/101',
    'valid legacy CN-100 in FY still counted',
  )

  // Undated malformed still ignored (same as before)
  assertEq(
    nextCreditNoteNo({
      existing: [{ cnNo: 'CN-25-26' }],
      monthOrDate: '2026-04',
    }),
    'CN-26-27/1',
    'malformed CN-25-26 undated ignored',
  )

  console.log('[financial-year] malformed CN FY parsing fixed')
}

console.log('financial-year.selftest: ok')
