/**
 * Fire Assay Print / PDF — show only rows with a Job Card Number.
 * Rendering filter only. Does not change assay chemistry or sheet storage.
 * Run: npx --yes tsx scripts/fire-assay-print-rows.selftest.ts
 */
import {
  arrangeFireAssayPresentation,
  FIRE_ASSAY_SHEET_FORMAT,
  finenessFromMasses,
  formatFireAssayReportDate,
  getFireAssayPreviewAndPrintRows,
  getPrintableFireAssayRows,
  pairMeanFineness,
} from '../src/data/fireAssayViewLayout.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

type PrintRow = {
  key: string
  jobCardNo: string
  sampleWeight: string
  silver: string
  lead: string
  wotgcaa: string
  fineness: string
  meanFineness: string
}

function emptySlot(i: number): PrintRow {
  return {
    key: `empty-${i}`,
    jobCardNo: '',
    sampleWeight: '',
    silver: '',
    lead: '',
    wotgcaa: '',
    fineness: '',
    meanFineness: '',
  }
}

function filledRow(i: number, jobCardNo: string, patch: Partial<PrintRow> = {}): PrintRow {
  return {
    key: `row-${i}`,
    jobCardNo,
    sampleWeight: '166.655',
    silver: '373.3',
    lead: '4.0',
    wotgcaa: '152.416',
    fineness: '916.123',
    meanFineness: '916.000',
    ...patch,
  }
}

function grid(valid: number, empty = 22 - valid, jobFor?: (i: number) => string) {
  const rows: PrintRow[] = []
  for (let i = 0; i < valid; i++) {
    const job = jobFor ? jobFor(i) : `1_10000000${String(i).padStart(2, '0')}`
    rows.push(filledRow(i, job))
  }
  for (let i = 0; i < empty; i++) rows.push(emptySlot(valid + i))
  return rows
}

// --- 1. 22 valid rows → 22 printed ---
{
  const rows = grid(22, 0)
  const printed = getPrintableFireAssayRows(rows)
  assertEq(printed.length, 22, '1. 22 valid rows print as 22')
  assert(
    printed.every((r) => r.jobCardNo.trim() !== ''),
    '1. every printed row has a Job Card',
  )
}

// --- 2. 20 valid + 2 empty → only 20 printed ---
{
  const rows = grid(20, 2)
  assertEq(rows.length, 22, '2. source grid is still 22')
  assertEq(getPrintableFireAssayRows(rows).length, 20, '2. only 20 printed')
}

// --- 3. 8 valid + 14 empty → only 8 printed ---
{
  const rows = grid(8, 14)
  assertEq(getPrintableFireAssayRows(rows).length, 8, '3. only 8 printed')
}

// --- 4. 4 jobs × 2 samples → only 8 printed ---
{
  const jobs = ['JobA', 'JobB', 'JobC', 'JobD']
  const rows = grid(8, 14, (i) => jobs[Math.floor(i / 2)])
  const printed = getPrintableFireAssayRows(rows)
  assertEq(printed.length, 8, '4. 4 jobs produce 8 printed sample rows')
  assertEq(printed.filter((r) => r.jobCardNo === 'JobA').length, 2, '4. Job A keeps both strips')
  assertEq(printed.filter((r) => r.jobCardNo === 'JobD').length, 2, '4. Job D keeps both strips')
}

// --- 4b. 10 jobs × 2 samples → 20 printed ---
{
  const jobs = Array.from({ length: 10 }, (_, i) => `Job${i + 1}`)
  const rows = grid(20, 2, (i) => jobs[Math.floor(i / 2)])
  const printed = getPrintableFireAssayRows(rows)
  assertEq(printed.length, 20, '4b. 10 jobs produce 20 printed sample rows')
}

// --- 5. Empty rows after valid rows are removed ---
{
  const rows = [
    filledRow(0, '1_111'),
    filledRow(1, '1_111'),
    emptySlot(2),
    emptySlot(3),
    { ...emptySlot(4), jobCardNo: '   ' },
  ]
  const printed = getPrintableFireAssayRows(rows)
  assertEq(printed.length, 2, '5. trailing empty / whitespace Job Cards removed')
  assert(
    printed.every((r) => r.key === 'row-0' || r.key === 'row-1'),
    '5. only the filled keys remain',
  )
}

// --- 6. Rows with a valid Job Card Number are never removed ---
{
  const keep = filledRow(0, '1_104736831')
  const printed = getPrintableFireAssayRows([keep, emptySlot(1)])
  assertEq(printed.length, 1, '6. one valid row kept')
  assert(printed[0] === keep, '6. same row object is preserved')
}

// --- 7. Job Card present but zero/empty secondary values still prints ---
{
  const sparse = filledRow(0, '1_8080132061', {
    sampleWeight: '0',
    silver: '',
    lead: '',
    wotgcaa: '',
    fineness: '',
    meanFineness: '',
  })
  const printed = getPrintableFireAssayRows([sparse, emptySlot(1)])
  assertEq(printed.length, 1, '7. sparse Job Card row is not filtered')
  assertEq(printed[0].jobCardNo, '1_8080132061', '7. Job Card kept')
  assertEq(printed[0].sampleWeight, '0', '7. zero sample weight still prints')
  assertEq(printed[0].silver, '', '7. empty silver still prints')
}

// --- 8. Preview and Print use exactly the same filtered rows ---
{
  const rows = grid(8, 14)
  const { previewRows, printRows } = getFireAssayPreviewAndPrintRows(rows)
  assert(previewRows === printRows, '8. preview and print share one array')
  assertEq(previewRows.length, 8, '8. shared list has 8 rows')
  assertEq(getPrintableFireAssayRows(rows).length, previewRows.length, '8. helper matches preview')
  assertEq(getPrintableFireAssayRows(rows).length, printRows.length, '8. helper matches print')
}

// --- 9. Existing calculations remain unchanged ---
{
  const f = finenessFromMasses(166.655, 152.416, 0)
  assertEq(f, Number((((152.416 + 0) / 166.655) * 1000).toFixed(3)).toFixed(3), '9. finenessFromMasses formula unchanged')
  const mean = pairMeanFineness('914.560', '913.120')
  assertEq(mean.first, '0.0', '9. pair mean first-row marker unchanged')
  assertEq(mean.second, '913.840', '9. pair mean arithmetic unchanged')
  const source = filledRow(0, '1_999', { fineness: '914.560', meanFineness: '0.0' })
  const [kept] = getPrintableFireAssayRows([source])
  assertEq(kept.fineness, '914.560', '9. filter does not recompute fineness')
  assertEq(kept.meanFineness, '0.0', '9. filter does not recompute mean fineness')
  assert(kept === source, '9. filter does not clone or rewrite the row')
}

// --- 10. Existing header/layout remains unchanged ---
{
  const cg1 = { key: 'cg1', jobCardNo: 'CG1', sampleDrawn: '150.200' }
  const cg2 = { key: 'cg2', jobCardNo: 'CG2', sampleDrawn: '150.180' }
  const s1 = { key: 's1', jobCardNo: '1_A', sampleDrawn: '333.310' }
  const s2 = { key: 's2', jobCardNo: '1_A', sampleDrawn: '333.310' }
  const blank = { key: 's3', jobCardNo: '', sampleDrawn: '' }
  const ordered = arrangeFireAssayPresentation([cg1, cg2, s1, s2, blank])
  assertEq(ordered[0].key, 'cg1', '10. CG1 still first')
  assertEq(ordered[ordered.length - 1].key, 'cg2', '10. CG2 still last')
  const printed = getPrintableFireAssayRows(ordered)
  assertEq(printed[0].key, 'cg1', '10. preview/print still starts with CG1')
  assertEq(printed[printed.length - 1].key, 'cg2', '10. preview/print still ends with CG2')
  assertEq(printed.length, 4, '10. CG1 + 2 samples + CG2; blank slot omitted')
  assertEq(printed[0].sampleDrawn, '150.200', '10. CG1 value unchanged')
  assertEq(printed[printed.length - 1].sampleDrawn, '150.180', '10. CG2 value unchanged')
}

// Source grid is not mutated
{
  const rows = grid(8, 14)
  getPrintableFireAssayRows(rows)
  assertEq(rows.length, 22, 'source 22-row grid is not shortened')
}

// --- 11. Existing formulas unchanged (see block 9) + F-25 header ---
{
  assertEq(FIRE_ASSAY_SHEET_FORMAT.formatNo, 'F-25', '11. format no is F-25')
  assertEq(FIRE_ASSAY_SHEET_FORMAT.preparedBy, 'QM', '11. prepared by label value')
  assertEq(FIRE_ASSAY_SHEET_FORMAT.approvedBy, 'TM', '11. approved by label value')
  assertEq(FIRE_ASSAY_SHEET_FORMAT.issuedBy, 'QM', '11. issued by label value')
  assertEq(formatFireAssayReportDate('2026-08-29'), '29-08-2026', '11. weighing/reporting date format')
  assertEq(formatFireAssayReportDate(''), '', '11. empty date stays empty')
}

// --- 12. Existing mapping unchanged: filter does not rewrite Job Card / CG keys ---
{
  const cg1 = { key: 'cg1', jobCardNo: 'CG1', lotNo: 0 }
  const a = { key: 's1', jobCardNo: '1_104736831', lotNo: 1 }
  const empty = { key: 's9', jobCardNo: '  ', lotNo: 5 }
  const preview = getPrintableFireAssayRows([cg1, a, empty])
  const print = getFireAssayPreviewAndPrintRows([cg1, a, empty]).printRows
  assert(preview === print || (preview.length === print.length && preview[0] === print[0]), '12. preview/print same rows')
  assertEq(preview[0].jobCardNo, 'CG1', '12. CG1 mapping unchanged')
  assertEq(preview[1].jobCardNo, '1_104736831', '12. Job Card mapping unchanged')
  assertEq(preview[1].lotNo, 1, '12. lot mapping unchanged')
}

console.log('fire-assay-print-rows.selftest: all checks passed')
