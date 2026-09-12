/**
 * Billing Unused Sample Return — live-read Fire Assay archive.
 * Run: npx --yes tsx scripts/billing-unused-sample.selftest.ts
 */
import { invoiceToChallan } from '../src/components/InvoiceChallan.tsx'
import {
  unusedSampleForRelatedRows,
  unusedSampleWeightGrams,
  unusedSampleWeightMg,
} from '../src/data/fireAssaySampleWeight.ts'
import type { ManakFireAssayRow, ManakFireAssaySheet } from '../src/data/manakFireAssayBridge.ts'
import type { Invoice } from '../src/data/store.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function row(
  partial: Partial<ManakFireAssayRow> & Pick<ManakFireAssayRow, 'jobCardNo'>,
): ManakFireAssayRow {
  const manak = partial.manakJobCard || partial.jobCardNo.replace(/^\d+[_\-/]/, '')
  return {
    lotNo: partial.lotNo ?? 1,
    jobCardNo: partial.jobCardNo,
    manakJobCard: manak,
    sampleDrawn: partial.sampleDrawn ?? 333.31,
    sampleWeight: partial.sampleWeight ?? 166.655,
    silver: 373.3,
    copper: 0,
    lead: 4,
    wotgcaa: partial.wotgcaa ?? 150,
    fineness: partial.fineness ?? 916,
    meanFineness: partial.meanFineness ?? 916,
    partyName: partial.partyName,
    requestNo: partial.requestNo,
  }
}

function sheet(rows: ManakFireAssayRow[], extra?: Partial<ManakFireAssaySheet>): ManakFireAssaySheet {
  return {
    version: 1,
    source: 'shrija-hallmark-suite',
    createdAt: extra?.createdAt || '2026-09-09T13:30:09.631Z',
    date: extra?.date || '2026-09-09',
    purity: extra?.purity || '750',
    shift: extra?.shift || 'Day',
    sheetNo: extra?.sheetNo || '1',
    assayType: extra?.assayType || 'Cg Auto',
    cg: extra?.cg || {
      cg1: 150,
      cg2: 150,
      silverCg1: 0,
      silverCg2: 0,
      copperCg1: 0,
      copperCg2: 0,
      leadCg1: 4,
      leadCg2: 4,
      wotgcaa1: 0,
      wotgcaa2: 0,
      delta1: 0,
      delta2: 0,
      avgDelta: 0,
    },
    rows,
  }
}

function invoice(partial: Partial<Invoice> & Pick<Invoice, 'requestNo'>): Invoice {
  return {
    id: partial.id || 'inv-test',
    invoiceNo: partial.invoiceNo || 'T/001',
    partyName: partial.partyName || 'Test Party',
    requestNo: partial.requestNo,
    amount: partial.amount ?? 100,
    tax: partial.tax ?? 18,
    total: partial.total ?? 118,
    status: partial.status || 'Unpaid',
    date: partial.date || '2026-09-12',
    unusedSample: partial.unusedSample,
    unusedSampleEdited: partial.unusedSampleEdited,
    sampleWeight: partial.sampleWeight,
    fireboxScrap: partial.fireboxScrap,
    weightReceived: partial.weightReceived,
    weightReturned: partial.weightReturned,
    lines: partial.lines,
  }
}

const JOB_A = '127655135'
const JOB_B = '127660511'
const JOB_C = '127660512'
const JOB_UNRELATED = '999000111'
const REQ = 'HM-UNUSED-1'
const REQ_B = 'HM-UNUSED-2'

const positiveSheet = sheet(
  [
    row({
      jobCardNo: `1_${JOB_A}`,
      manakJobCard: JOB_A,
      requestNo: REQ,
      sampleDrawn: 403.24,
      sampleWeight: 199.025,
      wotgcaa: 149.614,
    }),
    row({
      jobCardNo: `1_${JOB_A}`,
      manakJobCard: JOB_A,
      requestNo: REQ,
      sampleDrawn: 403.24,
      sampleWeight: 198.785,
      wotgcaa: 149.404,
    }),
  ],
  { purity: '750' },
)

const zeroSheet = sheet(
  [
    row({
      jobCardNo: `1_${JOB_B}`,
      manakJobCard: JOB_B,
      requestNo: REQ,
      sampleDrawn: 333.07,
      sampleWeight: 166.655,
      wotgcaa: 152.686,
    }),
    row({
      jobCardNo: `1_${JOB_B}`,
      manakJobCard: JOB_B,
      requestNo: REQ,
      sampleDrawn: 333.07,
      sampleWeight: 166.415,
      wotgcaa: 152.416,
    }),
  ],
  { purity: '916', createdAt: '2026-08-24T16:54:22.117Z' },
)

const jobCSheet = sheet(
  [
    row({
      jobCardNo: `1_${JOB_C}`,
      manakJobCard: JOB_C,
      requestNo: REQ,
      sampleDrawn: 332.81,
      sampleWeight: 164.5,
      wotgcaa: 150,
    }),
    row({
      jobCardNo: `1_${JOB_C}`,
      manakJobCard: JOB_C,
      requestNo: REQ,
      sampleDrawn: 332.81,
      sampleWeight: 164.31,
      wotgcaa: 149.9,
    }),
  ],
  { purity: '916', sheetNo: '2', createdAt: '2026-08-24T17:00:00.000Z' },
)

const unrelatedSheet = sheet(
  [
    row({
      jobCardNo: `1_${JOB_UNRELATED}`,
      manakJobCard: JOB_UNRELATED,
      requestNo: REQ_B,
      sampleDrawn: 400,
      sampleWeight: 190,
      wotgcaa: 170,
    }),
    row({
      jobCardNo: `1_${JOB_UNRELATED}`,
      manakJobCard: JOB_UNRELATED,
      requestNo: REQ_B,
      sampleDrawn: 400,
      sampleWeight: 190,
      wotgcaa: 170,
    }),
  ],
  { sheetNo: '9', createdAt: '2026-09-01T00:00:00.000Z' },
)

// --- TEST A: positive unused from archive (Haar analogue) ---
{
  const unusedMg = unusedSampleWeightMg(403.24, [199.025, 198.785])
  assertEq(unusedMg, 5.43, 'A. unused mg = drawn − strips')
  assertEq(unusedSampleWeightGrams(unusedMg), 0.005, 'A. unused grams uses existing 3 dp /1000')
  const grams = unusedSampleForRelatedRows([{ jobCardNo: JOB_A, requestNo: REQ }], {
    sheets: [positiveSheet],
    requestNo: REQ,
  })
  assertEq(grams, 0.005, 'A. Billing unused is archive-derived 0.005, not 0.000')
  assert(grams !== 0, 'A. Billing does not show 0.000 when archive unused is positive')
}

// --- TEST B: legitimate zero unused ---
{
  const unusedMg = unusedSampleWeightMg(333.07, [166.655, 166.415])
  assertEq(unusedMg, 0, 'B. unused mg is 0 when strips consume drawn')
  const grams = unusedSampleForRelatedRows([{ jobCardNo: JOB_B, requestNo: REQ }], {
    sheets: [zeroSheet],
    requestNo: REQ,
  })
  assertEq(grams, 0, 'B. Unused Sample Return = 0.000 is legitimate')
  assertEq(grams.toFixed(3), '0.000', 'B. display precision of legitimate zero')
}

// --- TEST C: archive positive, rough-sheet unused missing ---
{
  const related = [{ jobCardNo: JOB_A, requestNo: REQ }]
  const grams = unusedSampleForRelatedRows(related, {
    sheets: [positiveSheet],
    requestNo: REQ,
  })
  assertEq(grams, 0.005, 'C. missing roughSheets.unusedSample still uses Fire Assay archive')
}

// --- TEST D: existing invoice unusedSample = 0 must not freeze ---
{
  const view = invoiceToChallan(
    invoice({
      requestNo: REQ,
      unusedSample: 0,
      sampleWeight: 0.398,
      fireboxScrap: 0.299,
      weightReceived: 65.3,
      weightReturned: 64.902,
      lines: [
        {
          description: 'Haar',
          purity: '750',
          pcsRec: 4,
          hm: 3,
          rej: 0,
          melt: 1,
          rate: 45,
          amount: 135,
        },
      ],
    }),
    {
      roughSheets: [{ requestNo: REQ, jobCardNo: JOB_A, weight: 65.3, sampleWeight: 0.398 }],
      fireAssaySheets: [positiveSheet],
    },
  )
  assertEq(view.unusedSample, 0.005, 'D. existing invoice stored 0 is replaced by live archive unused')
  assertEq(view.weightReturned, 64.902, 'D. Weight Returned is unchanged')
}

// --- TEST E: multiple jobs summed; unrelated job excluded ---
{
  const related = [
    { jobCardNo: JOB_A, requestNo: REQ },
    { jobCardNo: JOB_C, requestNo: REQ },
  ]
  const grams = unusedSampleForRelatedRows(related, {
    sheets: [positiveSheet, jobCSheet, unrelatedSheet],
    requestNo: REQ,
  })
  const expectedA = unusedSampleWeightGrams(unusedSampleWeightMg(403.24, [199.025, 198.785]))
  const expectedC = unusedSampleWeightGrams(unusedSampleWeightMg(332.81, [164.5, 164.31]))
  assertEq(grams, Number((expectedA + expectedC).toFixed(3)), 'E. invoice unused = sum of billing jobs')
  assert(grams !== expectedA + expectedC + unusedSampleWeightGrams(unusedSampleWeightMg(400, [190, 190])), 'E. unrelated job is not summed')
}

{
  const crossed = unusedSampleForRelatedRows([{ jobCardNo: JOB_A, requestNo: REQ }], {
    sheets: [
      sheet([
        row({
          jobCardNo: `1_${JOB_A}`,
          manakJobCard: JOB_A,
          requestNo: REQ_B,
          sampleDrawn: 403.24,
          sampleWeight: 199.025,
        }),
        row({
          jobCardNo: `1_${JOB_A}`,
          manakJobCard: JOB_A,
          requestNo: REQ_B,
          sampleDrawn: 403.24,
          sampleWeight: 198.785,
        }),
      ]),
    ],
    requestNo: REQ,
  })
  assertEq(crossed, 0, 'E. Request No boundary does not take another request’s job')
}

// --- TEST F: archive wins over stale rough zero; pending falls back to rough ---
{
  const archiveWins = unusedSampleForRelatedRows(
    [{ jobCardNo: JOB_A, requestNo: REQ, unusedSample: 0 }],
    { sheets: [positiveSheet], requestNo: REQ },
  )
  assertEq(archiveWins, 0.005, 'F. archive available → Fire Assay calculation wins over rough 0')

  const pendingFallback = unusedSampleForRelatedRows(
    [{ jobCardNo: JOB_A, requestNo: REQ, unusedSample: 0.009 }],
    { sheets: [], requestNo: REQ },
  )
  assertEq(pendingFallback, 0.009, 'F. archive unavailable → rough-sheet fallback')

  const archiveZeroWins = unusedSampleForRelatedRows(
    [{ jobCardNo: JOB_B, requestNo: REQ, unusedSample: 0.009 }],
    { sheets: [zeroSheet], requestNo: REQ },
  )
  assertEq(archiveZeroWins, 0, 'F. archive ready unused = 0 is not overridden by stale rough positive')
}

{
  const returned = Number((65.3 - 0.398).toFixed(3))
  assertEq(returned, 64.902, 'Weight Returned remains received − sample')
  assert(returned !== Number((65.3 - 0.398 - 0.005).toFixed(3)), 'unused is not subtracted from Weight Returned')
}

console.log('billing-unused-sample.selftest: ok')
