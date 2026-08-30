/**
 * Fire Assay date-wise sheet numbers.
 * Each calendar date has its own 1, 2, 3… sequence.
 * Run: npx --yes tsx scripts/fire-assay-sheet-date.selftest.ts
 */
import {
  fireAssayArchiveWriteKey,
  fireAssaySheetDate,
  fireAssaySheetSelectOptions,
  listFireAssaySheetNosFrom,
  lookupFireAssaySheet,
  nextSheetNoAfter,
  type ManakFireAssaySheet,
} from '../src/data/manakFireAssayBridge.ts'
import {
  arrangeFireAssayPresentation,
  getPrintableFireAssayRows,
} from '../src/data/fireAssayViewLayout.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[fire-assay-sheet-date] ${msg}`)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `[fire-assay-sheet-date] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

const emptyCg: ManakFireAssaySheet['cg'] = {
  cg1: 0,
  cg2: 0,
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
}

function stubSheet(partial: Partial<ManakFireAssaySheet> & { sheetNo: string }): ManakFireAssaySheet {
  return {
    version: 1,
    source: 'shrija-hallmark-suite',
    createdAt: '2026-08-30T08:00:00.000Z',
    purity: '916',
    shift: 'Day',
    assayType: 'Cg Auto',
    cg: emptyCg,
    rows: [{ lotNo: 1, jobCardNo: '1_100', manakJobCard: '100', sampleDrawn: 1, sampleWeight: 1, silver: 1, copper: 0, lead: 4, wotgcaa: 1, fineness: 916, meanFineness: 916 }],
    ...partial,
  }
}

function seedLegacy(map: Record<string, ManakFireAssaySheet>, sheet: ManakFireAssaySheet) {
  const key = `${sheet.purity}|${sheet.shift || 'Day'}|${sheet.sheetNo}`
  map[key] = sheet
  return key
}

function dropdown(map: Record<string, ManakFireAssaySheet>, date: string, purity = '916', shift = 'Day') {
  const saved = listFireAssaySheetNosFrom(Object.values(map), purity, shift, date)
  const nextNew = nextSheetNoAfter(saved)
  const options = fireAssaySheetSelectOptions(saved, nextNew)
  return { saved, nextNew, options, values: options.map((o) => o.value) }
}

function assertLabelsAreNumbersOnly(options: { value: string; label: string }[], label: string) {
  for (const o of options) {
    assertEq(o.label, o.value, `${label}: label matches value`)
    assert(!/\(saved\)/i.test(o.label), `${label}: no (saved) on ${o.label}`)
    assert(!/\(new\)/i.test(o.label), `${label}: no (new) on ${o.label}`)
  }
}

const AUG30 = '2026-08-30'
const AUG31 = '2026-08-31'

function seedSheets(
  map: Record<string, ManakFireAssaySheet>,
  date: string,
  nos: string[],
  datedKey = false,
) {
  for (const n of nos) {
    const sheet = stubSheet({
      sheetNo: n,
      date,
      createdAt: `${date}T0${n}:00:00.000Z`,
      rows: [
        {
          lotNo: 1,
          jobCardNo: `1_hist${n}`,
          manakJobCard: `hist${n}`,
          sampleDrawn: Number(n),
          sampleWeight: Number(n),
          silver: 373.3,
          copper: 0,
          lead: 4,
          wotgcaa: 1,
          fineness: 916,
          meanFineness: 916,
        },
      ],
    })
    if (datedKey) map[`${date}|916|Day|${n}`] = sheet
    else seedLegacy(map, sheet)
  }
}

const historical: Record<string, ManakFireAssaySheet> = {}
seedSheets(historical, AUG30, ['1', '2', '3', '4'])
const historicalSnapshot = JSON.stringify(historical)

function simulateSave(
  map: Record<string, ManakFireAssaySheet>,
  date: string,
  sheetNo: string,
) {
  const sheet = stubSheet({
    sheetNo,
    date,
    createdAt: `${date}T12:00:00.000Z`,
    rows: [
      {
        lotNo: 1,
        jobCardNo: `1_save${sheetNo}`,
        manakJobCard: `save${sheetNo}`,
        sampleDrawn: 1,
        sampleWeight: 1,
        silver: 1,
        copper: 0,
        lead: 4,
        wotgcaa: 1,
        fineness: 916,
        meanFineness: 916,
      },
    ],
  })
  const key = fireAssayArchiveWriteKey(map, sheet)
  map[key] = sheet
  return key
}

// --- 1. No saved sheets → [1] ---
{
  const { values, options } = dropdown({}, AUG30)
  assertEq(values.join(','), '1', '1. empty date dropdown is [1]')
  assertEq(options.length, 1, '1. only one option')
  assertLabelsAreNumbersOnly(options, '1')
}

// --- 2. Sheet 1 saved → [1, 2] ---
{
  const map: Record<string, ManakFireAssaySheet> = {}
  simulateSave(map, AUG30, '1')
  const { values } = dropdown(map, AUG30)
  assertEq(values.join(','), '1,2', '2. after sheet 1 saved: [1, 2]')
}

// --- 3. Sheets 1–2 saved → [1, 2, 3] ---
{
  const map: Record<string, ManakFireAssaySheet> = {}
  simulateSave(map, AUG30, '1')
  simulateSave(map, AUG30, '2')
  const { values } = dropdown(map, AUG30)
  assertEq(values.join(','), '1,2,3', '3. after sheets 1–2 saved: [1, 2, 3]')
}

// --- 4. Sheets 1–5 saved → [1, 2, 3, 4, 5, 6] ---
{
  const map: Record<string, ManakFireAssaySheet> = {}
  for (const n of ['1', '2', '3', '4', '5']) simulateSave(map, AUG30, n)
  const { values, options } = dropdown(map, AUG30)
  assertEq(values.join(','), '1,2,3,4,5,6', '4. after 1–5 saved: [1–6]')
  assertEq(options.length, 6, '4. no extra future numbers')
}

// --- 5. Cancel a new sheet → number does NOT advance ---
{
  const map: Record<string, ManakFireAssaySheet> = {}
  const before = dropdown(map, AUG30)
  assertEq(before.values.join(','), '1', '5. start at [1]')
  const selectedUnsaved = before.nextNew
  assertEq(selectedUnsaved, '1', '5. opening/selecting 1 does not persist')
  const afterCancel = dropdown(map, AUG30)
  assertEq(afterCancel.values.join(','), '1', '5. cancel keeps [1]')
  assertEq(JSON.stringify(map), '{}', '5. archive unchanged on cancel')
}

// --- 6. Successfully save a new sheet → next advances by 1 ---
{
  const map: Record<string, ManakFireAssaySheet> = {}
  assertEq(dropdown(map, AUG30).values.join(','), '1', '6. before save: [1]')
  simulateSave(map, AUG30, '1')
  assertEq(dropdown(map, AUG30).values.join(','), '1,2', '6. after save: [1, 2]')
}

// --- 7. Date A has 1–5; Date B with none shows [1] ---
{
  const map: Record<string, ManakFireAssaySheet> = {}
  for (const n of ['1', '2', '3', '4', '5']) simulateSave(map, AUG30, n)
  assertEq(dropdown(map, AUG30).values.join(','), '1,2,3,4,5,6', '7. 30-Aug [1–6]')
  assertEq(dropdown(map, AUG31).values.join(','), '1', '7. 31-Aug with no sheets is [1]')
}

// --- 8. Returning to Date A restores [1,2,3,4,5,6] ---
{
  const map: Record<string, ManakFireAssaySheet> = {}
  for (const n of ['1', '2', '3', '4', '5']) simulateSave(map, AUG30, n)
  const first = dropdown(map, AUG30)
  dropdown(map, AUG31)
  const back = dropdown(map, AUG30)
  assertEq(back.values.join(','), '1,2,3,4,5,6', '8. back to 30-Aug restores [1–6]')
  assertEq(back.values.join(','), first.values.join(','), '8. same as first visit')
}

// --- 9–10. No "(saved)" / "(new)" text ---
{
  const { options, values } = dropdown(historical, AUG30)
  assertEq(values.join(','), '1,2,3,4,5', '9. historical 1–4 + next 5')
  assertLabelsAreNumbersOnly(options, '9-10')
  assert(
    options.every((o) => !o.label.includes('saved') && !o.label.includes('new')),
    '9-10. labels contain neither saved nor new',
  )
}

// --- 11. No arbitrary future numbers ---
{
  const { values, saved, nextNew } = dropdown(historical, AUG30)
  assertEq(values.length, saved.length + 1, '11. only saved + one next')
  assertEq(values[values.length - 1], nextNew, '11. last option is the next number')
  assert(!values.includes('19'), '11. 19 is not listed')
  assert(!values.includes('6'), '11. 6 is not listed when next is 5')
}

// --- 12. No duplicate next number ---
{
  const saved = ['1', '2', '3']
  const opts = fireAssaySheetSelectOptions(saved, '3')
  const values = opts.map((o) => o.value)
  assertEq(values.join(','), '1,2,3,4', '12. next 3 already saved → still add 4 once')
  assertEq(new Set(values).size, values.length, '12. no duplicate values')
  const again = fireAssaySheetSelectOptions(saved, '4')
  assertEq(again.map((o) => o.value).join(','), '1,2,3,4', '12. explicit next 4 is not duplicated')
}

// --- 13. Existing date-wise sheet identity remains intact ---
{
  const map = { ...historical }
  const aug31s1 = stubSheet({
    sheetNo: '1',
    date: AUG31,
    createdAt: `${AUG31}T09:00:00.000Z`,
    rows: [
      {
        lotNo: 1,
        jobCardNo: '1_newday',
        manakJobCard: 'newday',
        sampleDrawn: 9,
        sampleWeight: 9,
        silver: 1,
        copper: 0,
        lead: 4,
        wotgcaa: 1,
        fineness: 916,
        meanFineness: 916,
      },
    ],
  })
  const newKey = fireAssayArchiveWriteKey(map, aug31s1)
  const oldKey = '916|Day|1'
  assert(newKey !== oldKey, '13. 31-Aug sheet 1 uses a different archive key')
  map[newKey] = aug31s1
  const a = lookupFireAssaySheet(map, '916', 'Day', '1', AUG30)
  const b = lookupFireAssaySheet(map, '916', 'Day', '1', AUG31)
  assert(a && b, '13. both dates resolve sheet 1')
  assert(a !== b, '13. they are distinct records')
  assertEq(a.rows[0].jobCardNo, '1_hist1', '13. 30-Aug sheet 1 is historical')
  assertEq(b.rows[0].jobCardNo, '1_newday', '13. 31-Aug sheet 1 is the new one')
  assertEq(fireAssaySheetDate(historical['916|Day|1']), AUG30, '13. historical date from createdAt')
  assert(
    lookupFireAssaySheet(historical, '916', 'Day', '1', AUG31) == null,
    '13. lookup for 31-Aug sheet 1 does not return 30-Aug sheet 1',
  )
}

// Historical JSON is not modified by listing or by saving another date.
{
  const map: Record<string, ManakFireAssaySheet> = JSON.parse(historicalSnapshot)
  const before = JSON.stringify(map['916|Day|1'])
  dropdown(map, AUG30)
  dropdown(map, AUG31)
  lookupFireAssaySheet(map, '916', 'Day', '1', AUG30)
  simulateSave(map, AUG31, '1')
  assertEq(JSON.stringify(map['916|Day|1']), before, 'historical 30-Aug sheet 1 JSON is unchanged')
  assertEq(JSON.stringify(historical), historicalSnapshot, 'original historical map is untouched')
}

// Print / PDF row filter remains unchanged
{
  const cg1 = { key: 'cg1', jobCardNo: 'CG1', locked: true }
  const cg2 = { key: 'cg2', jobCardNo: 'CG2', locked: true }
  const filled = { key: 's1', jobCardNo: '1_104736831', locked: false }
  const empty = { key: 's2', jobCardNo: '', locked: false }
  const printable = getPrintableFireAssayRows([cg1, cg2, filled, empty])
  assert(
    printable.some((r) => r.jobCardNo === '1_104736831'),
    'print still keeps rows with a job card',
  )
  assert(!printable.some((r) => r.key === 's2'), 'print still hides empty job-card slots')
}

// Main View Fire Assay grid arrangement remains unchanged
{
  const cg1 = { key: 'cg1', jobCardNo: 'CG1', locked: true, sampleDrawn: '150.200' }
  const cg2 = { key: 'cg2', jobCardNo: 'CG2', locked: true, sampleDrawn: '150.180' }
  const sample = { key: 's1', jobCardNo: '1_104736831', locked: false }
  const ordered = arrangeFireAssayPresentation([cg1, cg2, sample])
  assertEq(ordered[0].key, 'cg1', 'View grid still starts with CG1')
  assertEq(ordered[ordered.length - 1].key, 'cg2', 'View grid still ends with CG2')
  assertEq(ordered[0].sampleDrawn, '150.200', 'CG1 value unchanged')
}

{
  const map: Record<string, ManakFireAssaySheet> = JSON.parse(historicalSnapshot)
  const updated = stubSheet({
    sheetNo: '2',
    date: AUG30,
    createdAt: `${AUG30}T02:00:00.000Z`,
  })
  assertEq(fireAssayArchiveWriteKey(map, updated), '916|Day|2', 'overwrite same date stays on legacy key')
}

console.log('fire-assay-sheet-date.selftest: ok')
