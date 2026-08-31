/**
 * Billing Generate Invoice — Fire Assay completion is Job Number + archive.
 * Run: npx --yes tsx scripts/billing-fire-assay-validation.selftest.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalJobCardNo,
  hasCompletedFireAssayForBillingJobs,
  hasCompletedFireAssayForJob,
} from '../src/data/fireAssaySampleWeight.ts'
import type { ManakFireAssayRow, ManakFireAssaySheet } from '../src/data/manakFireAssayBridge.ts'

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
    createdAt: extra?.createdAt || '2026-08-31T10:00:00.000Z',
    date: extra?.date || '2026-08-31',
    purity: extra?.purity || '916',
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

const JOB = '104736831'
const OTHER = '104736832'
const empty: ManakFireAssaySheet[] = []
const archived = [
  sheet([
    row({ jobCardNo: `1_${JOB}`, manakJobCard: JOB, sampleWeight: 166.1, wotgcaa: 150.1 }),
    row({ jobCardNo: `1_${JOB}`, manakJobCard: JOB, sampleWeight: 166.2, wotgcaa: 150.2 }),
  ]),
]
const archivedBare = [
  sheet([
    row({ jobCardNo: JOB, manakJobCard: JOB }),
    row({ jobCardNo: JOB, manakJobCard: JOB }),
  ]),
]
const archivedFaFirst = [
  sheet([
    row({ jobCardNo: `1_${JOB}`, manakJobCard: JOB }),
    row({ jobCardNo: `1_${JOB}`, manakJobCard: JOB }),
  ]),
]

assertEq(canonicalJobCardNo('1_104736831'), '104736831', 'lot 1 prefix stripped')
assertEq(canonicalJobCardNo('2_104736831'), '104736831', 'lot 2 prefix stripped')
assertEq(canonicalJobCardNo('104736831'), '104736831', 'bare job unchanged')
assert(canonicalJobCardNo('104736831') !== canonicalJobCardNo('104736832'), 'different jobs stay distinct')

// 1. Request first → no Fire Assay → billing blocked
assertEq(
  hasCompletedFireAssayForBillingJobs([JOB], empty),
  false,
  '1. request first, missing archive → blocked',
)
assertEq(hasCompletedFireAssayForJob(JOB, empty), false, '1. single job missing → blocked')

// 2. Request first → Fire Assay completed (archive has job, requestNo stamped) → allowed
{
  const withRequest = [
    sheet([
      row({ jobCardNo: `1_${JOB}`, manakJobCard: JOB, requestNo: 'HM-1' }),
      row({ jobCardNo: `1_${JOB}`, manakJobCard: JOB, requestNo: 'HM-1' }),
    ]),
  ]
  assertEq(
    hasCompletedFireAssayForBillingJobs([JOB], withRequest),
    true,
    '2. request first then archived sheet → allowed',
  )
}

// 3. Fire Assay first (no requestNo on sheet) → Request later → allowed
assertEq(
  hasCompletedFireAssayForBillingJobs([JOB], archivedFaFirst),
  true,
  '3. FA first, later billing job → allowed',
)
assertEq(
  hasCompletedFireAssayForJob(JOB, archivedFaFirst),
  true,
  '3. FA-first archive is enough; no second Create Sheet required',
)

// 4. Lot-prefixed Job Number matching
assertEq(hasCompletedFireAssayForJob('1_104736831', archived), true, '4. billing 1_JOB vs archive 1_JOB')
assertEq(hasCompletedFireAssayForJob('2_104736831', archived), true, '4. billing 2_JOB vs archive 1_JOB')
assertEq(hasCompletedFireAssayForJob(JOB, archived), true, '4. billing bare JOB vs archive 1_JOB')
assertEq(
  hasCompletedFireAssayForBillingJobs(['1_104736831'], archivedBare),
  true,
  '4. billing 1_JOB vs archive bare JOB',
)

// 5. Different Job Number → blocked (no false positive)
assertEq(hasCompletedFireAssayForJob(OTHER, archived), false, '5. 104736832 does not match 104736831')
assertEq(
  hasCompletedFireAssayForBillingJobs([OTHER], archived),
  false,
  '5. billing other job against JOB archive → blocked',
)

// 6. Missing Fire Assay → blocked
assertEq(hasCompletedFireAssayForBillingJobs([JOB], empty), false, '6. empty archive blocked')
assertEq(hasCompletedFireAssayForBillingJobs([''], empty), false, '6. empty job number blocked')
assertEq(hasCompletedFireAssayForBillingJobs([], archived), false, '6. no billing job numbers blocked')

// 7. Existing Fire Assay → no need to create another sheet (job in archive is enough)
assertEq(
  hasCompletedFireAssayForBillingJobs([JOB, `1_${JOB}`], archivedFaFirst),
  true,
  '7. request + lot-prefixed day-sheet job both resolve to the same archive record',
)

{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const billing = readFileSync(path.join(root, 'src/pages/Billing.tsx'), 'utf8')
  assert(
    billing.includes('hasCompletedFireAssayForBillingJobs'),
    'Billing Generate Invoice uses archive Job Number helper',
  )
  assert(
    billing.includes('Please complete Fire Assay first.'),
    'Billing still shows the required blocked message',
  )
  assert(
    !billing.includes('data.fireAssays.some'),
    'Billing must not treat store.fireAssays / Create Sheet as completion',
  )
  assert(
    !billing.includes("a.requestNo === request.requestNo && a.status === 'Completed'"),
    'Billing must not require a request-tied Completed fireAssays row',
  )
  assert(
    billing.includes('request.jobCardNo'),
    'Billing reads the request Job Number for Generate Invoice',
  )

  const helper = readFileSync(path.join(root, 'src/data/fireAssaySampleWeight.ts'), 'utf8')
  assert(helper.includes('newestSheetRowsForJob'), 'completion reuses existing archive sheet lookup')
  assert(helper.includes('canonicalJobCardNo'), 'completion uses existing lot-prefix canonical key')
  assert(
    helper.includes("export function fireAssaySampleWeightFromArchive"),
    'sample-weight archive helper is unchanged',
  )
  assert(
    helper.includes("export function fireAssayCornetFromArchive"),
    'cornet archive helper is unchanged',
  )
}

console.log('billing-fire-assay-validation.selftest: all assertions passed')
