/**
 * Fire Assay ↔ Request mapping for Sample Weight and Cornet Weight.
 * Run: npx --yes tsx scripts/fire-assay-cornet-sync.selftest.ts
 */
import {
  canonicalJobCardNo,
  fireAssayCornetFromArchive,
  fireAssayCornetFromRows,
  fireAssaySampleWeightFromArchive,
  fireAssaySampleWeightFromRows,
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

function row(partial: Partial<ManakFireAssayRow> & Pick<ManakFireAssayRow, 'jobCardNo'>): ManakFireAssayRow {
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
    wotgcaa: partial.wotgcaa ?? 0,
    fineness: partial.fineness ?? 916,
    meanFineness: partial.meanFineness ?? 916,
    partyName: partial.partyName,
    requestNo: partial.requestNo,
  }
}

function sheet(
  createdAt: string,
  rows: ManakFireAssayRow[],
  extra?: Partial<ManakFireAssaySheet>,
): ManakFireAssaySheet {
  return {
    version: 1,
    source: 'shrija-hallmark-suite',
    createdAt,
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

assertEq(canonicalJobCardNo('1_104736831'), '104736831', 'lot prefix stripped')
assertEq(canonicalJobCardNo('104736831'), '104736831', 'bare job card unchanged')

const pairA = [
  row({ jobCardNo: '1_111', requestNo: 'HM-A', sampleWeight: 166.1, wotgcaa: 150.1 }),
  row({ jobCardNo: '1_111', requestNo: 'HM-A', sampleWeight: 166.2, wotgcaa: 150.2 }),
]
const pairB = [
  row({ jobCardNo: '1_222', requestNo: 'HM-B', sampleWeight: 170.1, wotgcaa: 160.1 }),
  row({ jobCardNo: '1_222', requestNo: 'HM-B', sampleWeight: 170.2, wotgcaa: 160.2 }),
]

{
  const swA = fireAssaySampleWeightFromRows([...pairA, ...pairB], '111', { requestNo: 'HM-A' })
  const swB = fireAssaySampleWeightFromRows([...pairA, ...pairB], '222', { requestNo: 'HM-B' })
  const cA = fireAssayCornetFromRows([...pairA, ...pairB], '1_111', { requestNo: 'HM-A' })
  const cB = fireAssayCornetFromRows([...pairA, ...pairB], '222', { requestNo: 'HM-B' })
  assertEq(swA.status, 'ready', 'A sample ready')
  assertEq(swB.status, 'ready', 'B sample ready')
  assert(swA.total !== swB.total, 'A. Request A sample is not Request B sample')
  assertEq(cA.total, 300.3, 'A cornet is sum of its own wotgcaa')
  assertEq(cB.total, 320.3, 'B cornet is sum of its own wotgcaa')
  const leakA = fireAssayCornetFromRows([...pairA, ...pairB], '111', { requestNo: 'HM-B' })
  assertEq(leakA.status, 'pending', 'B request number does not receive A job cornet')
  const leakB = fireAssaySampleWeightFromRows([...pairA, ...pairB], '222', { requestNo: 'HM-A' })
  assertEq(leakB.status, 'pending', 'A request number does not receive B job sample')
}

{
  const faFirst = [
    row({ jobCardNo: '1_333', sampleWeight: 165.1, wotgcaa: 151.1 }),
    row({ jobCardNo: '1_333', sampleWeight: 165.2, wotgcaa: 151.2 }),
  ]
  const laterRequest = fireAssayCornetFromRows(faFirst, '333', { requestNo: 'HM-NEW' })
  const laterSample = fireAssaySampleWeightFromRows(faFirst, '333', { requestNo: 'HM-NEW' })
  assertEq(laterRequest.status, 'ready', 'B. Fire Assay first (no requestNo on sheet) still maps by job card')
  assertEq(laterRequest.total, 302.3, 'B. later request gets archive cornet')
  assertEq(laterSample.status, 'ready', 'B. later request gets archive sample weight')
}

{
  const older = sheet('2026-08-01T10:00:00.000Z', [
    row({ jobCardNo: '1_444', requestNo: 'HM-C', sampleWeight: 160, wotgcaa: 140 }),
    row({ jobCardNo: '1_444', requestNo: 'HM-C', sampleWeight: 161, wotgcaa: 141 }),
  ])
  const newer = sheet('2026-08-31T10:00:00.000Z', [
    row({ jobCardNo: '1_444', requestNo: 'HM-C', sampleWeight: 166.655, wotgcaa: 152.686 }),
    row({ jobCardNo: '1_444', requestNo: 'HM-C', sampleWeight: 166.415, wotgcaa: 152.416 }),
  ])
  const sw = fireAssaySampleWeightFromArchive('444', { requestNo: 'HM-C' }, [older, newer])
  const cor = fireAssayCornetFromArchive('1_444', { requestNo: 'HM-C' }, [older, newer])
  assertEq(sw.status, 'ready', 'C. Save All newest sheet is used for sample')
  assertEq(cor.status, 'ready', 'C. Save All newest sheet is used for cornet')
  assertEq(cor.total, 305.102, 'C. latest wotgcaa wins over the old sheet')
}

{
  const forOldJob = [
    row({ jobCardNo: '1_OLD', requestNo: 'HM-D', sampleWeight: 166.1, wotgcaa: 150 }),
    row({ jobCardNo: '1_OLD', requestNo: 'HM-D', sampleWeight: 166.2, wotgcaa: 151 }),
  ]
  const afterJobChange = fireAssayCornetFromRows(forOldJob, 'NEWJOB', { requestNo: 'HM-D' })
  assertEq(afterJobChange.status, 'pending', 'D/E. new job card does not keep old job cornet')
  const oldStill = fireAssayCornetFromRows(forOldJob, 'OLD', { requestNo: 'HM-D' })
  assertEq(oldStill.total, 301, 'old job card still reads its own cornet')
}

{
  const allowed = new Set(['HM-A'])
  const mixed = [...pairA, ...pairB]
  const ok = fireAssayCornetFromRows(mixed, '111', {
    requestNo: 'HM-A',
    allowRequestNo: (no) => allowed.has(no),
  })
  const blocked = fireAssayCornetFromRows(mixed, '222', {
    requestNo: 'HM-B',
    allowRequestNo: (no) => allowed.has(no),
  })
  assertEq(ok.total, 300.3, 'centre allow-list still returns own request')
  assertEq(blocked.status, 'pending', 'centre allow-list blocks another request no')
}

console.log('fire-assay-cornet-sync.selftest.ts: all assertions passed')
