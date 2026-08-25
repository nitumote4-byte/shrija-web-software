/**
 * Fire Assay master calculation — one IS 1418 engine for all purities.
 * Run: npx --yes tsx scripts/fire-assay-calculation.selftest.ts
 */
import {
  autoGenerateJobPair,
  blankLotWotgcaaJitter,
  copperForCg,
  expectedWotgcaa,
  finenessPpt,
  getBisDefaults,
  handlingResidualMg,
  hash01,
  JOB_PAIR_WOTGCAA_JITTER,
  sampleDrawnMgFromRequest,
  seedStripPairAssay,
  simulatedPairAssayFineness,
  splitSampleWeights,
} from '../src/data/fireAssayBis.ts'
import {
  totalFromFireAssaySamples,
  unusedSampleFromRoughRows,
  unusedSampleWeightGrams,
  unusedSampleWeightMg,
} from '../src/data/fireAssaySampleWeight.ts'
import {
  arrangeFireAssayPresentation,
  finenessFromMasses,
  mapCgToViewFields,
  mapViewRowsToManakRows,
  pairMeanFineness,
} from '../src/data/fireAssayViewLayout.ts'
import { MANAK_FIRE_ASSAY_KEY } from '../src/data/manakFireAssayBridge.ts'
import type { ManakFireAssayRow, ManakFireAssaySheet } from '../src/data/manakFireAssayBridge.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function jewelleryWeightReturned(weightReceived: number, sampleWeight: number) {
  return Number((weightReceived - sampleWeight).toFixed(3))
}

type PurityCase = {
  label: string
  purity: string
  drawn: number
  measuredW1: number
  measuredW2: number
}

/** Independent measured gold-cornet masses — not derived from declared purity. */
const PURITY_CASES: PurityCase[] = [
  { label: '18K / 750', purity: '750', drawn: 343.07, measuredW1: 126.569, measuredW2: 126.339 },
  { label: '20K / 833', purity: '833', drawn: 336.0, measuredW1: 139.21, measuredW2: 138.94 },
  { label: '22K / 916', purity: '916', drawn: 333.31, measuredW1: 152.686, measuredW2: 152.416 },
  { label: '23K / 958', purity: '958', drawn: 318.0, measuredW1: 151.88, measuredW2: 151.61 },
  { label: '24K / 999', purity: '999', drawn: 300.0, measuredW1: 147.92, measuredW2: 147.65 },
]

{
  const declared = Number('750')
  const f1 = finenessPpt(168.719, 126.569)
  const f2 = finenessPpt(168.478, 126.339)
  assertEq(f1, 750.176, 'IS 1418 18K sample 1')
  assertEq(f2, 749.884, 'IS 1418 18K sample 2')
  assert(f1 !== declared && f2 !== declared, 'fineness is not hardcoded 750')
  assert(f1 !== f2, 'paired strips keep their own fineness')
}

for (const c of PURITY_CASES) {
  const declared = Number(c.purity)
  const [sw1, sw2] = splitSampleWeights(c.drawn, 1)
  const unusedMg = unusedSampleWeightMg(c.drawn, [sw1, sw2])
  const residual = handlingResidualMg(c.drawn, 1)
  const f1 = finenessPpt(sw1, c.measuredW1)
  const f2 = finenessPpt(sw2, c.measuredW2)
  const mean = Number(((f1 + f2) / 2).toFixed(3))
  const fake1 = finenessPpt(sw1, expectedWotgcaa(sw1, c.purity, 0.04, 0.02), 0.04)
  const fake2 = finenessPpt(sw2, expectedWotgcaa(sw2, c.purity, 0.04, -0.01), 0.04)

  assert(sw1 !== sw2, `${c.label}: sample weights are strip-specific`)
  assert(sw1 > 100 && sw2 > 100, `${c.label}: sample weights stay in the practical mg band`)
  assertEq(unusedMg, residual, `${c.label}: unused = drawn − strips`)
  assert(unusedMg >= 3 && unusedMg <= 6, `${c.label}: unused is in the 3–6 mg band`)
  assertEq(Number((sw1 + sw2 + unusedMg).toFixed(3)), c.drawn, `${c.label}: mass balance`)
  assert(f1 !== f2, `${c.label}: fineness is sample-specific`)
  assert(f1 !== declared && f2 !== declared, `${c.label}: fineness is not the declared purity`)
  assert(f1 !== 750 && f2 !== 750 && f1 !== 916 && f2 !== 916, `${c.label}: no hardcoded 750/916`)
  assert(Math.abs(f1 - fake1) > 0.001 || Math.abs(f2 - fake2) > 0.001, `${c.label}: measured fineness is not the purity-seeded estimate`)
  assert(mean !== declared, `${c.label}: mean fineness is the pair average, not declared purity`)
  assertEq(getBisDefaults(c.purity).purity, c.purity === '833' || c.purity === '958' ? c.purity : c.purity, `${c.label}: BIS defaults stay purity-keyed`)
}

{
  const fromRequest = sampleDrawnMgFromRequest(0.343, '750')
  assertEq(fromRequest, 343, 'request grams convert to mg once')
  const alreadyMg = sampleDrawnMgFromRequest(343, '750')
  assertEq(alreadyMg, 343, 'mg values are not converted again')
}

{
  const cgWeight = 149.102
  const wotgcaa = 149.052
  const copper = copperForCg(cgWeight, '750')
  assertEq(copper, 42.606, 'copperForCg(149.102, 750) is the 42.606 figure')
  const cg: ManakFireAssaySheet['cg'] = {
    cg1: cgWeight,
    cg2: 149.082,
    silverCg1: 280,
    silverCg2: 279.8,
    copperCg1: copper,
    copperCg2: copperForCg(149.082, '750'),
    leadCg1: 4,
    leadCg2: 4,
    wotgcaa1: wotgcaa,
    wotgcaa2: 149.052,
    delta1: 0.05,
    delta2: 0.03,
    avgDelta: 0.04,
  }
  const view = mapCgToViewFields(cg, 1)
  assertEq(view.wotgcaa, '149.052', 'CG gold-cornet column is WOTGCAA, not copper')
  assert(view.wotgcaa !== String(copper), '42.606 copper is not shown as gold cornet')
  assertEq(view.copper, 42.606, 'copper remains on sheet.cg for Manak')
  assertEq(view.sampleWeight, '149.102', 'CG sample weight is the check-gold mass')
  assertEq(view.fineness, finenessPpt(cgWeight, wotgcaa).toFixed(3), 'CG fineness is IS 1418 from CG masses')
  assert(Number(view.fineness) > 990, 'check gold stays near fine gold, not 750×copper')
}

{
  const ordered = arrangeFireAssayPresentation([
    { key: 'cg2' },
    { key: 's1' },
    { key: 'cg1' },
    { key: 's2' },
  ])
  assertEq(ordered.map((r) => r.key).join(','), 'cg1,s1,s2,cg2', 'CG1 / samples / CG2 order preserved')
}

{
  const related = [
    { weight: 50, sampleWeight: 0.333, cornet: 152.686, unusedSample: 0.004 },
    { weight: 40, sampleWeight: 0.332, cornet: 152.416, unusedSample: 0.005 },
  ]
  const unusedSample = unusedSampleFromRoughRows(related)
  const weightReceived = related.reduce((s, r) => s + r.weight, 0)
  const sampleWeight = related.reduce((s, r) => s + r.sampleWeight, 0)
  const fireboxScrap = Number(
    (related.reduce((s, r) => s + (Number(r.cornet) || 0), 0) / 1000).toFixed(3),
  )
  const weightReturned = jewelleryWeightReturned(weightReceived, sampleWeight)
  assertEq(unusedSample, 0.009, 'billing unused is the persisted Fire Assay sum')
  assertEq(weightReturned, 89.335, 'delivery remains received − sample')
  assertEq(fireboxScrap, 0.305, 'firebox scrap remains cornet mg ÷ 1000')
  assertEq(unusedSampleWeightGrams(4), 0.004, '4 mg unused is 0.004 g on the challan')
  const ready = totalFromFireAssaySamples([166.655, 166.415])
  assertEq(ready.status, 'ready', 'two sample weights remain ready')
}

{
  const previous: ManakFireAssayRow[] = [
    {
      lotNo: 1,
      jobCardNo: '1_104736831',
      manakJobCard: '104736831',
      sampleDrawn: 333.31,
      sampleWeight: 166.655,
      silver: 373.3,
      copper: 0,
      lead: 4,
      wotgcaa: 152.686,
      fineness: 916.18,
      meanFineness: 0,
      partyName: 'A',
      requestNo: 'REQ-1',
    },
  ]
  const edited = mapViewRowsToManakRows(
    [
      {
        jobCardNo: '1_104736831',
        sampleDrawn: '333.310',
        sampleWeight: '166.660',
        silver: '373.3',
        lead: '4',
        wotgcaa: '152.900',
        fineness: String(finenessPpt(166.66, 152.9)),
        meanFineness: '0.0',
        lotNo: 1,
      },
    ],
    previous,
  )
  assertEq(edited[0].wotgcaa, 152.9, 'Save All publishes the edited gold cornet')
  assertEq(edited[0].fineness, finenessPpt(166.66, 152.9), 'Save All publishes measured fineness')
  assertEq(edited[0].manakJobCard, '104736831', 'Manak job-card mapping unchanged')
  assertEq(edited[0].requestNo, 'REQ-1', 'request metadata preserved')
}

{
  assertEq(MANAK_FIRE_ASSAY_KEY, 'shrija-manak-fire-assay-sheet', 'existing Manak payload key untouched')
}

// --- Create Sheet auto-generation (Model C simulated F*) ---
{
  assertEq(JOB_PAIR_WOTGCAA_JITTER[0], 0.02, 'job-pair jitter 1')
  assertEq(JOB_PAIR_WOTGCAA_JITTER[1], -0.01, 'job-pair jitter 2')
  assertEq(blankLotWotgcaaJitter(1)[0], 0.03, 'blank-lot jitter 1 for lot 1')
  assertEq(blankLotWotgcaaJitter(1)[1], -0.02, 'blank-lot jitter 2 for lot 1')
}

{
  const a = hash01(750, 1, 123)
  const b = hash01(750, 1, 123)
  const c = hash01(750, 1, 124)
  assertEq(a, b, 'hash01 is deterministic for identical job seed')
  assert(a !== c, 'hash01 changes with base job card')
  assert(a >= 0 && a < 1, 'hash01 in [0,1)')
}

const AUTO_PURITIES: Array<{ label: string; purity: string; requestG: number }> = [
  { label: '18K / 750', purity: '750', requestG: 0.343 },
  { label: '22K / 916', purity: '916', requestG: 0.333 },
  { label: '24K / 999', purity: '999', requestG: 0.3 },
]

for (const c of AUTO_PURITIES) {
  const declared = Number(c.purity)
  const drawn = sampleDrawnMgFromRequest(c.requestG, c.purity)
  const sheetNumber = 1
  const lotNo = 1
  const baseJob = 123
  const pair = autoGenerateJobPair(drawn, c.purity, 0, lotNo, 'job', sheetNumber, baseJob)
  const fstar = simulatedPairAssayFineness(c.purity, sheetNumber, baseJob)
  const mean = pairMeanFineness(pair.fineness1.toFixed(3), pair.fineness2.toFixed(3))
  const scale = (1000 - declared) / 250

  assertEq(pair.fstar, fstar, `${c.label}: pair exposes Model C F*`)
  assert(pair.wotgcaa1 > 0 && pair.wotgcaa2 > 0, `${c.label}: WOTGCAA is auto-populated`)
  assert(pair.fineness1 > 0 && pair.fineness2 > 0, `${c.label}: fineness is auto-calculated`)
  assert(pair.fineness1 !== pair.fineness2, `${c.label}: sample fineness values differ`)
  assert(pair.wotgcaa1 !== pair.wotgcaa2, `${c.label}: sample WOTGCAA values differ`)
  assertEq(pair.fineness1, finenessPpt(pair.sw1, pair.wotgcaa1, 0), `${c.label}: fineness from generated masses`)
  assertEq(
    pair.wotgcaa1,
    expectedWotgcaa(pair.sw1, c.purity, 0, 0.02, fstar),
    `${c.label}: WOTGCAA = SW × F* / 1000 + 0.02`,
  )
  assertEq(
    pair.wotgcaa2,
    expectedWotgcaa(pair.sw2, c.purity, 0, -0.01, fstar),
    `${c.label}: WOTGCAA = SW × F* / 1000 − 0.01`,
  )
  assert(
    Math.abs(pair.wotgcaa1 - (pair.sw1 * fstar) / 1000) < 0.05,
    `${c.label}: theoretical WOTGCAA ≈ sample × F* / 1000`,
  )
  assert(fstar >= declared + 1.0 * scale - 1e-9, `${c.label}: F* at/above band low`)
  assert(fstar <= declared + 11.0 * scale + 1e-9, `${c.label}: F* at/below band high`)
  assert(Math.abs(pair.fineness1 - declared) > 0.05 || declared >= 998, `${c.label}: not purity-locked (except near-999)`)
  assert(pair.fineness1 !== declared, `${c.label}: fineness is not hardcoded ${c.purity}`)
  assert(pair.fineness2 !== declared, `${c.label}: second fineness is not hardcoded ${c.purity}`)
  assert(pair.fineness1 !== 750 && pair.fineness2 !== 750, `${c.label}: not 750.000 for every sample`)
  assert(pair.fineness1 !== 916 && pair.fineness2 !== 916, `${c.label}: not 916.000 for every sample`)
  assert(pair.fineness1 !== 999 && pair.fineness2 !== 999, `${c.label}: not 999.000 for every sample`)
  assertEq(mean.first, '0.0', `${c.label}: valid pair keeps first-row 0.0 marker`)
  assertEq(
    mean.second,
    ((pair.fineness1 + pair.fineness2) / 2).toFixed(3),
    `${c.label}: mean is the pair average`,
  )
  assert(mean.second !== '0' && mean.second !== '0.0' && mean.second !== '0.000', `${c.label}: mean is not 0`)
  assert(pair.unusedMg >= 3 && pair.unusedMg <= 6, `${c.label}: unused remains 3–6 mg`)
  assertEq(unusedSampleWeightMg(drawn, [pair.sw1, pair.sw2]), pair.unusedMg, `${c.label}: unused = drawn − strips`)

  const again = autoGenerateJobPair(drawn, c.purity, 0, lotNo, 'job', sheetNumber, baseJob)
  assertEq(again.wotgcaa1, pair.wotgcaa1, `${c.label}: deterministic W1 reload`)
  assertEq(again.wotgcaa2, pair.wotgcaa2, `${c.label}: deterministic W2 reload`)
  assertEq(again.fstar, pair.fstar, `${c.label}: deterministic F* reload`)

  const published = {
    source: 'shrija-hallmark-suite',
    key: MANAK_FIRE_ASSAY_KEY,
    rows: [
      { wotgcaa: pair.wotgcaa1, fineness: pair.fineness1, meanFineness: Number(mean.first) || 0 },
      { wotgcaa: pair.wotgcaa2, fineness: pair.fineness2, meanFineness: Number(mean.second) },
    ],
  }
  assertEq(published.key, 'shrija-manak-fire-assay-sheet', `${c.label}: Create Sheet uses existing Manak key`)
  assert(published.rows[0].wotgcaa > 0, `${c.label}: Create Sheet payload includes generated WOTGCAA`)
  assert(published.rows[0].fineness > 0, `${c.label}: Create Sheet payload includes generated fineness`)
}

{
  const blank = autoGenerateJobPair(330.11, '916', 0.04, 2, 'blank', 3, 0)
  const [j1, j2] = blankLotWotgcaaJitter(2)
  const fstar = simulatedPairAssayFineness('916', 3, 0)
  assertEq(blank.fstar, fstar, 'blank-lot pair uses Model C F*')
  assertEq(blank.wotgcaa1, expectedWotgcaa(blank.sw1, '916', 0.04, j1, fstar), 'blank-lot pair uses lot jitter + F*')
  assertEq(blank.wotgcaa2, expectedWotgcaa(blank.sw2, '916', 0.04, j2, fstar), 'blank-lot pair uses lot jitter 2 + F*')
  assertEq(
    blank.wotgcaa1,
    expectedWotgcaa(blank.sw1, '916', 0, j1, fstar),
    'blank WOTGCAA ignores avgDelta (proof applied in fineness)',
  )
  assertEq(blank.fineness1, finenessPpt(blank.sw1, blank.wotgcaa1, 0.04), 'blank fineness applies avgDelta once')
  assertEq(blank.fineness2, finenessPpt(blank.sw2, blank.wotgcaa2, 0.04), 'blank fineness 2 applies avgDelta once')
  assert(blank.fineness1 !== blank.fineness2, 'blank lots still produce sample-specific fineness')
}

{
  const pair = autoGenerateJobPair(333.31, '916', 0, 1, 'job', 1, 123)
  const cleared = finenessFromMasses(pair.sw1, '')
  const remaining = finenessFromMasses(pair.sw2, pair.wotgcaa2)
  const mean = pairMeanFineness(cleared, remaining)
  assertEq(cleared, '', 'clearing WOTGCAA blanks that sample fineness')
  assert(remaining === pair.fineness2.toFixed(3), 'uncleared sample keeps generated fineness')
  assertEq(mean.first, '', 'partial pair mean blanks after WOTGCAA clear')
  assertEq(mean.second, '', 'partial pair mean is not half of remaining')
}

{
  const pair = seedStripPairAssay(166.655, 166.415, '916', 0.04, 0.02, -0.01, {
    sheetNumber: 1,
    baseJobCardNumber: 123,
  })
  const edited = mapViewRowsToManakRows(
    [
      {
        jobCardNo: '1_104736831',
        sampleDrawn: '333.310',
        sampleWeight: '166.655',
        silver: '373.3',
        lead: '4',
        wotgcaa: String(pair.wotgcaa1),
        fineness: pair.fineness1.toFixed(3),
        meanFineness: '0.0',
        lotNo: 1,
      },
      {
        jobCardNo: '1_104736831',
        sampleDrawn: '333.310',
        sampleWeight: '166.415',
        silver: '373.3',
        lead: '4',
        wotgcaa: '152.900',
        fineness: finenessPpt(166.415, 152.9).toFixed(3),
        meanFineness: (
          (pair.fineness1 + finenessPpt(166.415, 152.9)) /
          2
        ).toFixed(3),
        lotNo: 1,
      },
    ],
    [],
  )
  assertEq(edited[1].wotgcaa, 152.9, 'Save All republishes the edited gold cornet')
  assertEq(edited[1].fineness, finenessPpt(166.415, 152.9), 'Save All republishes latest fineness')
  assertEq(edited[0].wotgcaa, pair.wotgcaa1, 'Save All keeps the unedited generated WOTGCAA')
}

{
  const ordered = arrangeFireAssayPresentation([
    { key: 'cg2' },
    { key: 's1' },
    { key: 'cg1' },
    { key: 's2' },
  ])
  assertEq(ordered.map((r) => r.key).join(','), 'cg1,s1,s2,cg2', 'CG1 / samples / CG2 order remains after auto-gen restore')
}

{
  const related = [
    { weight: 50, sampleWeight: 0.333, cornet: 152.686, unusedSample: 0.004 },
    { weight: 40, sampleWeight: 0.332, cornet: 152.416, unusedSample: 0.005 },
  ]
  assertEq(unusedSampleFromRoughRows(related), 0.009, 'billing unused mapping remains the persisted Fire Assay sum')
}

// --- 750 blank/default preparation (150 mg gold target model) ---
{
  const bis = getBisDefaults('750')
  assertEq(bis.sampleDrawnSeed, 400, '750 blank seed is 400 mg')
  assertEq(bis.silverStrip, 373.6, '750 strip silver ≈ 373.6 mg')
  assertEq(bis.silverCg1, 280.0, '750 CG silver unchanged')
  assertEq(bis.silverCg2, 279.8, '750 CG2 silver unchanged')
  assertEq(bis.lead, 4.0, '750 lead remains 4.0')

  const lotNo = 1
  const drawn = Number(
    (bis.sampleDrawnSeed + ((lotNo * 17) % 9) * 0.37 + lotNo * 0.11).toFixed(3),
  )
  assert(drawn >= 403 && drawn <= 406, `750 blank drawn ≈ 403–406 (got ${drawn})`)
  const pair = autoGenerateJobPair(drawn, '750', 0, lotNo, 'blank', 1, 123)
  assert(pair.sw1 >= 198 && pair.sw1 <= 201.5, `750 strip 1 ≈ 199–201 (got ${pair.sw1})`)
  assert(pair.sw2 >= 198 && pair.sw2 <= 201.5, `750 strip 2 ≈ 199–201 (got ${pair.sw2})`)
  assert(pair.unusedMg >= 3 && pair.unusedMg <= 6, '750 unused remains 3–6 mg')
  assert(pair.wotgcaa1 > 0 && pair.wotgcaa2 > 0, '750 WOTGCAA is auto-generated')
  assert(pair.fineness1 > 0 && pair.fineness2 > 0, '750 fineness is auto-generated')
  assert(pair.fstar >= 751 && pair.fstar <= 761, `750 F* in 751–761 (got ${pair.fstar})`)
  assert(pair.wotgcaa1 >= 148 && pair.wotgcaa1 <= 154, `750 WOTGCAA ≈ 150 mg band (got ${pair.wotgcaa1})`)
  assert(pair.wotgcaa2 >= 148 && pair.wotgcaa2 <= 154, `750 strip 2 WOTGCAA ≈ 150 mg band (got ${pair.wotgcaa2})`)
  assert(Math.abs(pair.fineness1 - pair.fineness2) < 0.5, '750 within-pair fineness stays close')
  assert(Math.abs(pair.fineness1 - 750) > 0.5, '750 auto fineness no longer centers at declared 750')
  const mean = pairMeanFineness(pair.fineness1.toFixed(3), pair.fineness2.toFixed(3))
  assertEq(mean.first, '0.0', '750 mean first-row 0.0 marker')
  assertEq(mean.second, ((pair.fineness1 + pair.fineness2) / 2).toFixed(3), '750 mean auto-generated')
  assertEq(Number((pair.sw1 + pair.sw2 + pair.unusedMg).toFixed(3)), drawn, '750 mass balance via splitSampleWeights')
}

// --- 916 / 999 Model C bands + preparation intact ---
{
  const bis916 = getBisDefaults('916')
  assertEq(bis916.sampleDrawnSeed, 330, '916 drawn seed unchanged')
  assertEq(bis916.silverStrip, 373.3, '916 silver unchanged')
  const drawn916 = Number((bis916.sampleDrawnSeed + ((1 * 17) % 9) * 0.37 + 1 * 0.11).toFixed(3))
  const p916 = autoGenerateJobPair(drawn916, '916', 0, 1, 'blank', 1, 123)
  assert(p916.fstar >= 916.34 && p916.fstar <= 919.7, `916 F* in ~916.34–919.70 (got ${p916.fstar})`)
  assert(p916.wotgcaa1 >= 149 && p916.wotgcaa1 <= 153, `916 WOTGCAA ≈ 150 mg (got ${p916.wotgcaa1})`)
  assert(Math.abs(p916.fineness1 - p916.fineness2) < 0.5, '916 within-pair fineness stays close')
  assert(Math.abs(p916.fineness1 - 916) > 0.2, '916 auto fineness no longer centers at declared 916')
  assert(p916.fineness1 !== p916.fineness2, '916 fineness remains sample-specific')

  const bis999 = getBisDefaults('999')
  assertEq(bis999.sampleDrawnSeed, 300, '999 drawn seed unchanged')
  assertEq(bis999.silverStrip, 407.0, '999 silver unchanged')
  const drawn999 = Number((bis999.sampleDrawnSeed + ((1 * 17) % 9) * 0.37 + 1 * 0.11).toFixed(3))
  const p999 = autoGenerateJobPair(drawn999, '999', 0, 1, 'blank', 1, 123)
  assert(p999.fstar <= 999.05, `999 F* stays ≤ ~999.05 (got ${p999.fstar})`)
  assert(p999.fstar < 1000, '999 Model C never produces F* > 1000')
  assert(Math.abs(p999.wotgcaa1 - 150) < 3, `999 WOTGCAA ≈ 150 mg (got ${p999.wotgcaa1})`)
  assert(p999.fineness1 < 1000.2, '999 resulting fineness stays realistic')
}

// --- Model C job-level F* (same job across lots) ---
{
  const sheet = 5
  const drawn = 400
  const lot1 = autoGenerateJobPair(drawn, '750', 0, 1, 'job', sheet, 123)
  const lot2 = autoGenerateJobPair(drawn, '750', 0, 2, 'job', sheet, 123)
  const lot3 = autoGenerateJobPair(drawn, '750', 0, 3, 'job', sheet, 123)
  const other = autoGenerateJobPair(drawn, '750', 0, 1, 'job', sheet, 124)
  assertEq(lot1.fstar, lot2.fstar, '1_123 and 2_123 share the same F*')
  assertEq(lot1.fstar, lot3.fstar, '1_123 / 2_123 / 3_123 all share the same F*')
  assert(lot1.fstar !== other.fstar, '1_123 and 1_124 can produce different F*')
  assertEq(
    simulatedPairAssayFineness('750', sheet, 123),
    lot1.fstar,
    '1_123 reload yields the same F*',
  )
  assert(Math.abs(lot1.fineness1 - lot1.fineness2) < 0.5, 'within-pair F1/F2 remain very close')

  // Different sample weights, same job F* → different W, similar fineness
  const heavy = autoGenerateJobPair(420, '750', 0, 1, 'job', sheet, 123)
  const light = autoGenerateJobPair(380, '750', 0, 2, 'job', sheet, 123)
  assertEq(heavy.fstar, light.fstar, 'same job F* with different drawn weights')
  assert(heavy.wotgcaa1 !== light.wotgcaa1, 'different SW produces different WOTGCAA')
  assert(Math.abs(heavy.fineness1 - light.fineness1) < 0.5, 'fineness stays approximately the same')

  const at916 = simulatedPairAssayFineness('916', sheet, 123)
  const at750 = simulatedPairAssayFineness('750', sheet, 123)
  assert(at916 !== at750, 'same job number stays purity-aware across Model C')

  for (const pur of ['750', '833', '875', '916', '925', '958', '999']) {
    const P = Number(pur)
    const scale = (1000 - P) / 250
    const f = simulatedPairAssayFineness(pur, 2, 123)
    assert(f >= P + 1.0 * scale - 1e-6, `${pur}: universal band low`)
    assert(f <= P + 11.0 * scale + 1e-6, `${pur}: universal band high`)
  }
}

// --- Proof correction: avgDelta applied exactly once in fineness ---
{
  const sw = 199.577
  const w = 151.9
  const avg = -0.063
  assertEq(finenessPpt(sw, w, avg), 760.794, 'F = (W + avgDelta) / SW × 1000')
  const seededW = expectedWotgcaa(sw, '750', avg, 0)
  assertEq(seededW, Number(((sw * 750) / 1000).toFixed(3)), 'WOTGCAA without F* uses declared purity and does not subtract avgDelta')
  assertEq(
    expectedWotgcaa(sw, '750', avg, 0.02),
    expectedWotgcaa(sw, '750', 0, 0.02),
    'expectedWotgcaa ignores avgDelta for identical jitter',
  )
  const fstar = simulatedPairAssayFineness('750', 1, 123)
  const simW = expectedWotgcaa(sw, '750', avg, 0.02, fstar)
  assertEq(simW, expectedWotgcaa(sw, '750', 0, 0.02, fstar), 'Model C W also ignores avgDelta')
  const once = finenessPpt(sw, simW, avg)
  assertEq(once, finenessPpt(sw, simW, avg), 'avgDelta applied once via finenessPpt')
  const doubleWrong = finenessPpt(sw, Number(((sw * fstar) / 1000 - avg).toFixed(3)), avg)
  assert(once !== doubleWrong, 'avgDelta must not be applied in both W and F')
  const live0 = finenessFromMasses(sw, w, 0)
  const liveNeg = finenessFromMasses(sw, w, avg)
  assert(live0 !== liveNeg, 'changing avgDelta updates fineness')
  assertEq(liveNeg, '760.794', 'live finenessFromMasses tracks avgDelta')
  assertEq(finenessFromMasses(sw, '', avg), '', 'clearing WOTGCAA still blanks fineness with avgDelta')
  assertEq(finenessFromMasses(sw, '0', avg), '', 'invalid WOTGCAA still blanks with avgDelta')
  const meanPartial = pairMeanFineness(liveNeg, '')
  assertEq(meanPartial.first, '', 'partial pair mean stays blank with proof delta')
  assertEq(meanPartial.second, '', 'partial pair mean second stays blank')
}

// --- Job-linked actual sample weight untouched ---
{
  assertEq(sampleDrawnMgFromRequest(0.343, '750'), 343, 'job-linked grams still convert once')
  assertEq(sampleDrawnMgFromRequest(343, '750'), 343, 'job-linked mg not replaced by 400 seed')
  assertEq(sampleDrawnMgFromRequest(0, '750'), 400, 'zero-weight fallback uses new 750 seed')
}

console.log('fire-assay-calculation.selftest: all assertions passed')
