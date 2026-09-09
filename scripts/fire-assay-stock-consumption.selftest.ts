/**
 * Fire assay consumes gold, silver, copper, lead, acid from QM / Lab stock.
 * Run: npx --yes tsx scripts/fire-assay-stock-consumption.selftest.ts
 */
import { resetTenantCache } from '../src/data/tenantCache.ts'
import { tenantSet } from '../src/data/tenant.ts'
import {
  ACID_LTR_PER_CUPEL,
  applyFireAssayStockConsumption,
  fireAssayConsumptionSheetKey,
  fireAssaySheetUsage,
} from '../src/data/fireAssayConsumption.ts'
import {
  GOLD_LAB_KEY,
  LAB_GOLD_CG_KEY,
  loadGoldList,
  type GoldLabEntry,
} from '../src/data/stockLedger.ts'
import { loadChain } from '../src/data/qmStockChain.ts'
import { loadLabChain } from '../src/data/labStockChain.ts'
import type { ManakFireAssayRow, ManakFireAssaySheet } from '../src/data/manakFireAssayBridge.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertClose(actual: number, expected: number, label: string, eps = 1e-9) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

const mem = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => {
    mem.set(k, String(v))
  },
  removeItem: (k: string) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })
mem.set('shrija-active-tenant', 'tn-fa-stock')

globalThis.fetch = (async () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  }) as Response) as typeof fetch

function row(partial: Partial<ManakFireAssayRow> & Pick<ManakFireAssayRow, 'jobCardNo'>): ManakFireAssayRow {
  return {
    lotNo: partial.lotNo ?? 1,
    jobCardNo: partial.jobCardNo,
    manakJobCard: partial.manakJobCard || partial.jobCardNo.replace(/^\d+[_\-/]/, ''),
    sampleDrawn: partial.sampleDrawn ?? 330,
    sampleWeight: partial.sampleWeight ?? 165,
    silver: partial.silver ?? 373.3,
    copper: partial.copper ?? 0,
    lead: partial.lead ?? 4,
    wotgcaa: partial.wotgcaa ?? 151.2,
    fineness: partial.fineness ?? 916,
    meanFineness: partial.meanFineness ?? 916,
    partyName: partial.partyName,
    requestNo: partial.requestNo,
  }
}

function sheet(extra?: Partial<ManakFireAssaySheet>): ManakFireAssaySheet {
  return {
    version: 1,
    source: 'shrija-hallmark-suite',
    createdAt: '2026-09-09T08:00:00.000Z',
    date: extra?.date || '2026-09-09',
    purity: extra?.purity || '916',
    shift: extra?.shift || 'Day',
    sheetNo: extra?.sheetNo || '1',
    assayType: extra?.assayType || 'Cg Auto',
    cg: extra?.cg || {
      cg1: 149.102,
      cg2: 149.08,
      silverCg1: 342,
      silverCg2: 341.8,
      copperCg1: 14.3,
      copperCg2: 14.2,
      leadCg1: 4,
      leadCg2: 4,
      wotgcaa1: 136.5,
      wotgcaa2: 136.4,
      delta1: 0.1,
      delta2: 0.12,
      avgDelta: 0.11,
    },
    rows: extra?.rows || [
      row({ jobCardNo: '1_111', silver: 373.3, lead: 4 }),
      row({ jobCardNo: '1_111', lotNo: 1, silver: 373.3, lead: 4 }),
    ],
    ...extra,
  }
}

{
  const usage = fireAssaySheetUsage(sheet())
  assertEq(usage.cupelCount, 4, '2 strips + 2 CG cupels')
  assertClose(usage.silverG, 1.4304, 'silver mg → g')
  assertClose(usage.copperG, 0.0285, 'copper mg → g')
  assertClose(usage.copperMg, 28.5, 'copper stays mg on QM chain')
  assertClose(usage.leadG, 16, 'lead foil stays grams')
  assertClose(usage.leadKg, 0.016, 'lead g → kg for lab ledger')
  assertClose(usage.acidLtr, 4 * ACID_LTR_PER_CUPEL, 'acid 40 ml per assay piece')
  assertClose(usage.goldG, 0.298182, 'CG mg → g')
  assertClose(usage.goldCornetG, 0.2729, 'WOTGCAA mg → g')
  assertEq(
    fireAssayConsumptionSheetKey(sheet()),
    '2026-09-09|916|Day|1',
    'sheet consumption identity',
  )
}

{
  const usage = fireAssaySheetUsage(
    sheet({
      rows: [row({ jobCardNo: '   ', silver: 999, lead: 4 })],
      cg: {
        cg1: 150,
        cg2: 0,
        silverCg1: 342,
        silverCg2: 0,
        copperCg1: 14,
        copperCg2: 0,
        leadCg1: 4,
        leadCg2: 0,
        wotgcaa1: 137,
        wotgcaa2: 0,
        delta1: 0,
        delta2: 0,
        avgDelta: 0,
      },
    }),
  )
  assertEq(usage.cupelCount, 1, 'empty job cards skipped; CG1 only')
  assertClose(usage.silverG, 0.342, 'CG1 silver only')
  assertClose(usage.copperG, 0.014, 'CG1 copper only')
  assertClose(usage.leadKg, 0.004, 'CG1 lead 4 g → kg')
  assertClose(usage.acidLtr, ACID_LTR_PER_CUPEL, 'one assay piece of acid')
}

resetTenantCache()
tenantSet('shrija-active-tenant', 'tn-fa-stock')

const first = applyFireAssayStockConsumption(sheet())
assertClose(first.silverG, 1.4304, 'apply returns usage')

assertEq(loadChain('silver', 'usage').length, 1, 'QM silver return one row')
assertClose(loadChain('silver', 'usage')[0].weight, 1.4304, 'QM silver return grams')
assertEq(loadChain('bis-silver', 'usage').length, 1, 'BIS silver return one row')
assertClose(loadChain('copper', 'usage')[0].weight, 28.5, 'QM copper usage mg')
assertClose(loadChain('lead', 'usage')[0].weight, 16, 'QM lead usage grams')
assertClose(loadChain('acid', 'usage')[0].weight, 0.16, 'QM acid usage ltr')
assertEq(loadChain('cuppels', 'usage')[0].weight, 4, 'QM cupels used')
assertEq(loadChain('cuppels', 'usage')[0].size, '6', 'QM cupels 6-cavity block')
assertEq(loadChain('bis-cupels', 'usage')[0].size, '16', 'BIS cupels 16 mm for 4 g Pb')

assertEq(loadLabChain('silver', 'process').length, 1, 'Lab silver in-assay one row')
assertClose(loadLabChain('silver', 'process')[0].weight, 1.4304, 'Lab silver in-assay grams')
assertClose(loadLabChain('copper', 'used')[0].weight, 28.5, 'Lab copper used mg')
assertClose(loadLabChain('lead', 'used')[0].weight, 16, 'Lab lead used grams')
assertClose(loadLabChain('acid', 'used')[0].weight, 0.16, 'Lab acid used ltr')
assertEq(loadLabChain('cuppels', 'used')[0].weight, 4, 'Lab cupels used')
assertEq(loadLabChain('bis-copper', 'used').length, 1, 'BIS lab copper used')

const labGold = loadGoldList<GoldLabEntry>(LAB_GOLD_CG_KEY)
assertEq(labGold.length, 1, 'lab gold CG one usage row')
assertClose(labGold[0].weight, 0.298182, 'lab gold CG grams')
assertClose(labGold[0].cornetWeight, 0.2729, 'lab gold cornet grams')
const qmLab = loadGoldList<GoldLabEntry>(GOLD_LAB_KEY)
assertEq(qmLab.length, 1, 'QM gold lab receipt one row')

applyFireAssayStockConsumption(
  sheet({
    rows: [row({ jobCardNo: '1_222', silver: 200, lead: 4 })],
  }),
)
assertEq(loadChain('silver', 'usage').length, 1, 'overwrite does not duplicate QM silver usage')
assertClose(loadChain('silver', 'usage')[0].weight, 0.8838, 'overwrite replaces QM silver return')
assertEq(loadLabChain('silver', 'process').length, 1, 'overwrite does not duplicate lab silver in-assay')
assertClose(loadLabChain('silver', 'process')[0].weight, 0.8838, 'overwrite replaces lab silver in-assay')
assertEq(loadGoldList<GoldLabEntry>(LAB_GOLD_CG_KEY).length, 1, 'overwrite does not duplicate gold CG')

resetTenantCache()
applyFireAssayStockConsumption(sheet({ sheetNo: '9' }))
assertEq(loadChain('silver', 'usage').length, 1, 'QM chain usage is posted without prior receipt')
assertEq(loadLabChain('lead', 'used').length, 1, 'Lab used is posted without prior inbound')

console.log('fire-assay-stock-consumption.selftest.ts: all assertions passed')
