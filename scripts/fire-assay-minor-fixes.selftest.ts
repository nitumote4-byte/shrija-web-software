/**
 * Fire Assay minor fixes — CG order, unused sample, fineness, Save All → Manak.
 * Run: npx --yes tsx scripts/fire-assay-minor-fixes.selftest.ts
 */
import {
  autoGenerateJobPair,
  expectedWotgcaa,
  finenessPpt,
  getBisDefaults,
  handlingResidualMg,
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
  formatFinenessCell,
  manakJobCardOf,
  mapViewRowsToManakRows,
  pairMeanFineness,
} from '../src/data/fireAssayViewLayout.ts'
import { MANAK_FIRE_ASSAY_KEY } from '../src/data/manakFireAssayBridge.ts'
import type { ManakFireAssayRow } from '../src/data/manakFireAssayBridge.ts'

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

const cg1 = { key: 'cg1', sampleDrawn: '150.200', jobCardNo: 'CG1', locked: true }
const cg2 = { key: 'cg2', sampleDrawn: '150.180', jobCardNo: 'CG2', locked: true }
const sampleA = { key: 's1', sampleDrawn: '333.310', jobCardNo: '1_104736831', locked: false }
const sampleB = { key: 's2', sampleDrawn: '333.310', jobCardNo: '1_104736831', locked: false }

// --- 1–3. CG Weight 1 above samples, CG Weight 2 below, values unchanged ---
{
  const ordered = arrangeFireAssayPresentation([cg1, cg2, sampleA, sampleB])
  assertEq(ordered[0].key, 'cg1', '1. CG Weight 1 appears before sample section')
  assert(
    ordered.findIndex((r) => r.key === 's1') > 0 &&
      ordered.findIndex((r) => r.key === 's1') < ordered.length - 1,
    '1. sample section is between CG rows',
  )
  assertEq(ordered[ordered.length - 1].key, 'cg2', '2. CG Weight 2 appears after sample section')
  assertEq(ordered[0].sampleDrawn, '150.200', '3. CG1 value unchanged')
  assertEq(ordered[ordered.length - 1].sampleDrawn, '150.180', '3. CG2 value unchanged')
}

{
  const filtered = arrangeFireAssayPresentation([cg1, cg2, sampleA])
  assertEq(filtered[0].key, 'cg1', 'job filter still keeps CG1 first')
  assertEq(filtered[filtered.length - 1].key, 'cg2', 'job filter still keeps CG2 last')
}

// --- 4. Sample weights preserved individually ---
{
  const r = totalFromFireAssaySamples([166.655, 166.415])
  assertEq(r.sample1, 166.655, '4. sample 1 preserved')
  assertEq(r.sample2, 166.415, '4. sample 2 preserved')
  assert(r.sample1 !== r.sample2, '4. samples are not forced equal')
}

// --- 5. Multiple sample counts (2–6) using existing sheet rows, not a hardcoded pair ---
{
  for (const n of [2, 3, 4, 5, 6]) {
    const weights = Array.from({ length: n }, (_, i) => 160 + i * 0.111)
    const r = totalFromFireAssaySamples(weights)
    assertEq(r.status, 'ready', `5. ${n} samples are ready`)
    assertEq(r.samples.length, n, `5. ${n} samples retained`)
    assertEq(r.sample1, weights[0], `5. sample 1 identity for n=${n}`)
  }
  const one = totalFromFireAssaySamples([166.655])
  assertEq(one.status, 'incomplete', '5. existing one-sample incomplete rule intact')
}

// --- 6–7. Unused sample is the actual calculated difference ---
{
  const drawn = 333.31
  const samples = [166.655, 166.415]
  const unusedMg = unusedSampleWeightMg(drawn, samples)
  assertEq(unusedMg, Number((drawn - 166.655 - 166.415).toFixed(3)), '6. unused = drawn − samples')
  assert(unusedMg !== 3 && unusedMg !== 4 && unusedMg !== 5, '6. unused is not a hardcoded mg')
}

{
  const [sw1, sw2] = splitSampleWeights(333.31, 1)
  const unusedMg = unusedSampleWeightMg(333.31, [sw1, sw2])
  const residual = handlingResidualMg(333.31, 1)
  assertEq(unusedMg, residual, '6. unused follows the recorded split')
  assert(unusedMg >= 3 && unusedMg <= 6, '7. new split unused is in the 3–6 mg band')
  assert(sw1 !== sw2, '7. strips are not an equal split of drawn')
  assertEq(Number((sw1 + sw2 + unusedMg).toFixed(3)), 333.31, '7. drawn is not altered')
}

// --- 8. Billing fetches persisted unused; does not recalculate chemistry ---
{
  const related = [
    { weight: 50, sampleWeight: 0.333, cornet: 152.686, unusedSample: 0.004 },
    { weight: 40, sampleWeight: 0.332, cornet: 152.416, unusedSample: 0.005 },
  ]
  const unusedSample = unusedSampleFromRoughRows(related)
  assertEq(unusedSample, 0.009, '8. billing unused is the Fire Assay persisted sum')
}

// --- 9–11. Existing delivery figures unchanged except unused integration ---
{
  const related = [
    { weight: 50, sampleWeight: 0.333, cornet: 152.686, unusedSample: 0.004 },
    { weight: 40, sampleWeight: 0.332, cornet: 152.416, unusedSample: 0.005 },
  ]
  const weightReceived = related.reduce((s, r) => s + r.weight, 0)
  const sampleWeight = related.reduce((s, r) => s + r.sampleWeight, 0)
  const fireboxScrap = Number(
    (related.reduce((s, r) => s + (Number(r.cornet) || 0), 0) / 1000).toFixed(3),
  )
  const unusedSample = unusedSampleFromRoughRows(related)
  const weightReturned = jewelleryWeightReturned(weightReceived, sampleWeight)
  assertEq(weightReceived, 90, '9. received weight formula unchanged')
  assertEq(sampleWeight, 0.665, '9. sample weight still summed from day sheet')
  assertEq(fireboxScrap, 0.305, '10. residual / firebox still cornet mg ÷ 1000')
  assertEq(weightReturned, 89.335, '11. delivery still received − sample, unused not subtracted')
  assertEq(unusedSample, 0.009, '11. unused is reported separately')
  assert(
    weightReturned !== jewelleryWeightReturned(weightReceived, sampleWeight + unusedSample),
    '11. unused is not folded into sample weight',
  )
}

// --- 12–13. Fineness is the assay result, not a universal 916.0 ---
{
  const f1 = finenessPpt(166.655, 152.686)
  const f2 = finenessPpt(166.415, 152.416)
  const f3 = finenessPpt(166.525, 152.9)
  assert(f1 !== 916 && f1 !== 916.0, '12. sample 1 fineness is not forced 916.0')
  assert(f2 !== 916 && f2 !== 916.0, '12. sample 2 fineness is not forced 916.0')
  assert(f1 !== f2, '13. different samples retain different fineness')
  assert(f3 !== f1 && f3 !== f2, '13. a third sample keeps its own result')
  assertEq(formatFinenessCell(f1), f1.toFixed(3), '12. fineness shown at 3 dp')
  assertEq(formatFinenessCell('Copper 1'), 'Copper 1', '12. CG label is not replaced with 916')
}

// --- 14. Existing BIS / pass seed values remain ---
{
  assertEq(getBisDefaults('916').silverStrip, 373.3, '14. 916 silver strip unchanged')
  assertEq(getBisDefaults('750').lead, 4.0, '14. lead default unchanged')
  assertEq(getBisDefaults('750').silverStrip, 373.6, '14. 750 strip silver updated to ≈373.6')
  assertEq(getBisDefaults('750').sampleDrawnSeed, 400, '14. 750 drawn seed updated to 400')
  const w = expectedWotgcaa(166.655, '916', 0.04, 0.02)
  assertEq(w, expectedWotgcaa(166.655, '916', 0, 0.02), '14. avgDelta not subtracted from WOTGCAA')
  const f = finenessPpt(166.655, w, 0.04)
  assert(f > 0, '14. fineness still comes from (wotgcaa + avgDelta) / sampleWeight')
  assertEq(finenessPpt(199.577, 151.9, -0.063), 760.794, '14. proof F = (W + avgDelta) / SW × 1000')
}

// --- 15–17. View edits persist into the existing Manak row mapping ---
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
    {
      lotNo: 1,
      jobCardNo: '1_104736831',
      manakJobCard: '104736831',
      sampleDrawn: 333.31,
      sampleWeight: 166.415,
      silver: 373.3,
      copper: 0,
      lead: 4,
      wotgcaa: 152.416,
      fineness: 915.879,
      meanFineness: 916.03,
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
        wotgcaa: '152.686',
        fineness: '916.152',
        meanFineness: '0.0',
        lotNo: 1,
      },
      {
        jobCardNo: '1_104736831',
        sampleDrawn: '333.310',
        sampleWeight: '166.415',
        silver: '373.3',
        lead: '4',
        wotgcaa: '152.416',
        fineness: '915.879',
        meanFineness: '916.016',
        lotNo: 1,
      },
    ],
    previous,
  )
  assertEq(edited[0].sampleWeight, 166.66, '15–16. Save All uses the latest sample weight')
  assertEq(edited[0].sampleWeight !== 166.655, true, '17. old 166.655 is not sent')
  assertEq(edited[0].jobCardNo, '1_104736831', '19. job card mapping unchanged')
  assertEq(edited[0].manakJobCard, '104736831', '19. Manak job card mapping unchanged')
  assertEq(edited[0].silver, 373.3, '20. silver mapping unchanged')
  assertEq(edited[0].lead, 4, '20. lead mapping unchanged')
  assertEq(edited[0].wotgcaa, 152.686, '20. M2 / WOTGCAA mapping unchanged')
  assertEq(edited[0].requestNo, 'REQ-1', '21. request / party metadata preserved')
  assertEq(edited[1].fineness, 915.879, '13. second sample fineness preserved')
}

// --- 18. Existing Manak upload still uses one sheet key (no second system) ---
{
  assertEq(MANAK_FIRE_ASSAY_KEY, 'shrija-manak-fire-assay-sheet', '18. existing Manak payload key')
}

{
  assertEq(manakJobCardOf('1_127087789'), '127087789', '19. lot prefix strip unchanged')
  assertEq(unusedSampleWeightGrams(4), 0.004, '8. 4 mg unused is 0.004 g on the challan')
}

// --- Mean Fineness: empty / partial / stale WOTGCAA ---
{
  const empty = pairMeanFineness('', '')
  assertEq(empty.first, '', 'A. empty pair first mean is blank')
  assertEq(empty.second, '', 'A. empty pair second mean is blank')
  assert(empty.first !== '0' && empty.first !== '0.0' && empty.first !== '0.000', 'A. empty is not 0')
  assert(empty.second !== '0' && empty.second !== '0.0' && empty.second !== '0.000', 'A. empty is not 0.0')

  const fromZero = pairMeanFineness('0', '0.0')
  assertEq(fromZero.first, '', 'A. numeric zero fineness is not a valid pair')
  assertEq(fromZero.second, '', 'A. numeric zero fineness mean is blank')
}

{
  const f1 = finenessPpt(166.655, 152.686)
  const partialA = pairMeanFineness(f1.toFixed(3), '')
  const partialB = pairMeanFineness('', f1.toFixed(3))
  assertEq(partialA.first, '', 'B. partial pair mean is blank')
  assertEq(partialA.second, '', 'B. partial pair mean is blank (second)')
  assertEq(partialB.second, '', 'B. reversed partial pair mean is blank')
  assert(
    partialA.second !== (f1 / 2).toFixed(3),
    'B. valid fineness is not divided by 2',
  )
}

{
  const f1 = finenessPpt(163.134, 149.936)
  const f2 = finenessPpt(163.668, 150.423)
  const mean = pairMeanFineness(f1.toFixed(3), f2.toFixed(3))
  assertEq(mean.first, '0.0', 'C. valid pair keeps first-row 0.0 marker')
  assertEq(mean.second, ((f1 + f2) / 2).toFixed(3), 'C. both valid → arithmetic mean')
}

{
  assertEq(finenessFromMasses(166.655, ''), '', 'D. cleared WOTGCAA blanks fineness')
  assertEq(finenessFromMasses(166.655, '0'), '', 'D. invalid WOTGCAA blanks fineness')
  assertEq(finenessFromMasses(166.655, 152.686), finenessPpt(166.655, 152.686).toFixed(3), 'D. valid masses keep IS 1418')
}

{
  const f1 = finenessFromMasses(166.655, 152.686)
  const f2cleared = finenessFromMasses(166.415, '')
  const mean = pairMeanFineness(f1, f2cleared)
  assert(f1 !== '', 'E. remaining sample keeps its fineness')
  assertEq(f2cleared, '', 'E. cleared WOTGCAA clears that sample fineness')
  assertEq(mean.first, '', 'E. pair mean clears when one WOTGCAA is cleared')
  assertEq(mean.second, '', 'E. pair mean is blank, not half')
}

{
  const f1 = finenessFromMasses(166.655, 152.686)
  const f2 = finenessFromMasses(166.415, 152.416)
  const mean = pairMeanFineness(f1, f2)
  assertEq(f1, finenessPpt(166.655, 152.686).toFixed(3), 'F. re-entered WOTGCAA recalculates fineness')
  assertEq(f2, finenessPpt(166.415, 152.416).toFixed(3), 'F. second sample recalculates')
  assertEq(mean.second, ((Number(f1) + Number(f2)) / 2).toFixed(3), 'F. mean recalculates from both')
}

{
  const ordered = arrangeFireAssayPresentation([cg1, sampleA, sampleB, cg2])
  assertEq(ordered[0].key, 'cg1', 'G. CG1 remains first')
  assertEq(ordered[ordered.length - 1].key, 'cg2', 'G. CG2 remains last')
}

{
  const [sw1, sw2] = splitSampleWeights(333.31, 1)
  const unusedMg = unusedSampleWeightMg(333.31, [sw1, sw2])
  assert(unusedMg >= 3 && unusedMg <= 6, 'H. unused 3–6 mg band unchanged')
}

{
  assertEq(MANAK_FIRE_ASSAY_KEY, 'shrija-manak-fire-assay-sheet', 'I. Manak payload key unchanged')
}

{
  const pair = autoGenerateJobPair(333.31, '916', 0, 1, 'job')
  assert(pair.wotgcaa1 > 0 && pair.wotgcaa2 > 0, 'J. Create Sheet still auto-populates WOTGCAA')
  assert(pair.fineness1 !== pair.fineness2, 'J. generated fineness stays sample-specific')
  const mean = pairMeanFineness(pair.fineness1.toFixed(3), pair.fineness2.toFixed(3))
  assertEq(mean.second, ((pair.fineness1 + pair.fineness2) / 2).toFixed(3), 'J. pair mean from generated fineness')
  const cleared = finenessFromMasses(pair.sw1, '')
  assertEq(cleared, '', 'J. clearing generated WOTGCAA still blanks fineness')
  assertEq(pairMeanFineness(cleared, pair.fineness2.toFixed(3)).second, '', 'J. partial mean stays blank')
}

console.log('fire-assay-minor-fixes.selftest: all assertions passed')
