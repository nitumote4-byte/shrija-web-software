/**
 * Operational Financial Period — create, switch, isolate, numbering context.
 * Run: npx --yes tsx scripts/operational-period.selftest.ts
 */
import {
  applyCreatePeriod,
  applySwitchWorkingPeriod,
  calendarPeriodFromDate,
  ensureDefaultPeriodState,
  recordBelongsToPeriod,
  recordPeriodName,
  validateNewPeriod,
  type OperationalPeriodState,
} from '../src/data/operationalPeriod.ts'
import { nextInvoiceNo, nextKeyedDocumentNo } from '../src/utils/documentNumbers.ts'
import {
  datesForPeriodName,
  formatDisplayDate,
  getFinancialYear,
  parsePeriodName,
} from '../src/utils/financialYear.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`[operational-period] ${msg}`)
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(
      `[operational-period] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

function emptyState(): OperationalPeriodState {
  return { periods: [], workingPeriodId: null }
}

// --- Period name / calendar mapping ---
{
  assertEq(parsePeriodName('2026-27')?.name, '2026-27', 'parse 2026-27')
  assertEq(parsePeriodName('26-27')?.name, '2026-27', 'parse 26-27')
  assertEq(parsePeriodName('2026-28'), null, 'reject mismatched year token')
  assertEq(datesForPeriodName('2026-27')?.start, '2026-04-01', 'start 01-04-2026')
  assertEq(datesForPeriodName('2026-27')?.end, '2027-03-31', 'end 31-03-2027')
  assertEq(formatDisplayDate('2026-04-01'), '01-04-2026', 'display start')
  assertEq(getFinancialYear('2026-04-01'), '2026-27', '01-Apr-2026 → 2026-27')
  assertEq(getFinancialYear('2027-03-31'), '2026-27', '31-Mar-2027 → 2026-27')
  const cal = calendarPeriodFromDate('2026-08-15')
  assertEq(cal.name, '2026-27', 'calendar period from August 2026')
  assertEq(cal.startDate, '2026-04-01', 'calendar start')
  assertEq(cal.endDate, '2027-03-31', 'calendar end')
}

// 1. Create 2026-27
let state = emptyState()
{
  const created = applyCreatePeriod(state, {
    name: '2026-27',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
  })
  assert(created.ok, 'create 2026-27')
  if (!created.ok) throw new Error('unreachable')
  state = created.state
  assertEq(created.period.name, '2026-27', 'created name')
  assertEq(created.period.startDate, '2026-04-01', 'created start')
  assertEq(created.period.endDate, '2027-03-31', 'created end')
  assertEq(created.period.status, 'working', 'first period is working')
  assertEq(state.workingPeriodId, created.period.id, 'working id set')
  console.log('[operational-period] create 2026-27')
}

// 2–3. Set / keep 2026-27 as current (already working)
{
  const switched = applySwitchWorkingPeriod(state, '2026-27')
  assert(switched.ok, 'set 2026-27 current')
  if (!switched.ok) throw new Error('unreachable')
  state = switched.state
  assertEq(switched.period.name, '2026-27', 'dashboard period 2026-27')
  assertEq(switched.period.status, 'working', 'only working period')
  console.log('[operational-period] set 2026-27 as current')
}

// 4. Create 2027-28
{
  const created = applyCreatePeriod(state, {
    name: '2027-28',
    startDate: '2027-04-01',
    endDate: '2028-03-31',
  })
  assert(created.ok, 'create 2027-28')
  if (!created.ok) throw new Error('unreachable')
  state = created.state
  assertEq(created.period.status, 'available', 'new period does not steal working')
  assertEq(state.periods.length, 2, 'two periods stored')
  const working = state.periods.find((p) => p.id === state.workingPeriodId)
  assertEq(working?.name, '2026-27', '2026-27 still working after create')
  console.log('[operational-period] create 2027-28')
}

// 5–6. Switch to 2027-28
{
  const switched = applySwitchWorkingPeriod(state, '2027-28')
  assert(switched.ok, 'switch 2027-28')
  if (!switched.ok) throw new Error('unreachable')
  state = switched.state
  assertEq(switched.period.name, '2027-28', 'dashboard shows 2027-28')
  const workingCount = state.periods.filter((p) => p.id === state.workingPeriodId).length
  assertEq(workingCount, 1, 'only one working period')
  console.log('[operational-period] switch to 2027-28')
}

// 7–8. Switch back to 2026-27
{
  const switched = applySwitchWorkingPeriod(state, '2026-27')
  assert(switched.ok, 'switch back')
  if (!switched.ok) throw new Error('unreachable')
  state = switched.state
  assertEq(switched.period.name, '2026-27', 'dashboard shows 2026-27 again')
  console.log('[operational-period] switch back to 2026-27')
}

// 9–12. Isolation: tagged 2026-27 record must not appear as 2025-26
{
  const tx2026 = {
    invoiceNo: '26-27/001',
    date: '2026-08-31',
    operationalPeriod: '2026-27',
  }
  const snapshot = JSON.stringify(tx2026)

  assert(recordBelongsToPeriod(tx2026, '2026-27'), '2026-27 tx belongs to 2026-27')
  assert(!recordBelongsToPeriod(tx2026, '2025-26'), '2026-27 tx is not a 2025-26 tx')
  assertEq(recordPeriodName(tx2026), '2026-27', 'tag wins over calendar date')

  const switchedAway = applySwitchWorkingPeriod(state, '2027-28')
  assert(switchedAway.ok, 'switch away does not rewrite tx')
  assertEq(JSON.stringify(tx2026), snapshot, 'switching does not mutate historical records')
  const switchedBack = applySwitchWorkingPeriod(state, '2026-27')
  assert(switchedBack.ok, 'switch back')
  if (switchedBack.ok) state = switchedBack.state
  assert(recordBelongsToPeriod(tx2026, '2026-27'), 'still 2026-27 after switch back')
  assertEq(tx2026.invoiceNo, '26-27/001', 'transaction remains intact')
  console.log('[operational-period] period isolation')
}

// Untagged historical records follow their date, not the working switch
{
  const old = { invoiceNo: 'INV-2026-001', date: '2026-07-01' }
  assertEq(recordPeriodName(old), '2026-27', 'untagged July 2026 → 2026-27')
  assert(recordBelongsToPeriod(old, '2026-27'), 'untagged visible in 2026-27')
  assert(!recordBelongsToPeriod(old, '2025-26'), 'untagged not visible in 2025-26')
}

// 13. Old document numbers unchanged; working period drives new numbers
{
  const historical = { invoiceNo: 'INV-2026-001', date: '2026-07-01', operationalPeriod: '2026-27' }
  const snapshot = JSON.parse(JSON.stringify(historical)) as typeof historical
  const nextInOld = nextInvoiceNo({
    prefix: '',
    startFrom: 1,
    invoices: [historical],
    date: '2026-08-31',
    periodName: '2025-26',
  })
  assertEq(nextInOld, '25-26/001', 'working 2025-26 numbering ignores 2026-27 docs')
  const nextInSame = nextInvoiceNo({
    prefix: '',
    startFrom: 1,
    invoices: [historical],
    date: '2026-08-31',
    periodName: '2026-27',
  })
  assertEq(nextInSame, '26-27/002', 'working 2026-27 continues that period')
  assertEq(historical.invoiceNo, snapshot.invoiceNo, 'historical invoiceNo unchanged')
  assertEq(JSON.stringify(historical), JSON.stringify(snapshot), 'historical object not mutated')

  const hm = nextKeyedDocumentNo({
    key: 'HM',
    existing: [{ no: 'HM-26-27-001', date: '2026-08-01', operationalPeriod: '2026-27' }],
    date: '2026-08-31',
    periodName: '2025-26',
  })
  assertEq(hm, 'HM-25-26-001', 'HM sequence is per working period')
  console.log('[operational-period] document numbering period context')
}

// 14. Duplicate / overlapping periods rejected
{
  const dup = validateNewPeriod(
    { name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' },
    state.periods,
  )
  assert(!dup.ok && dup.error === 'duplicate', 'duplicate period rejected')

  const overlapBadName = validateNewPeriod(
    { name: '2026-99', startDate: '2026-10-01', endDate: '2027-09-30' },
    [{ name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' }],
  )
  assert(!overlapBadName.ok && overlapBadName.error === 'invalid_name', 'invalid period name rejected')

  const overlapNamed = validateNewPeriod(
    { name: '2025-26', startDate: '2026-01-01', endDate: '2026-12-31' },
    [{ name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' }],
  )
  assert(!overlapNamed.ok && overlapNamed.error === 'overlap', 'overlapping dates rejected')

  const order = validateNewPeriod(
    { name: '2028-29', startDate: '2029-03-31', endDate: '2028-04-01' },
    [],
  )
  assert(!order.ok && order.error === 'start_after_end', 'start must be before end')

  const okNext = validateNewPeriod(
    { name: '2028-29', startDate: '2028-04-01', endDate: '2029-03-31' },
    state.periods,
  )
  assert(okNext.ok, 'non-overlapping 2028-29 accepted')
  console.log('[operational-period] validation')
}

// 15. Only one working period
{
  const with2025 = applyCreatePeriod(state, {
    name: '2025-26',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
  })
  assert(with2025.ok, 'create 2025-26')
  if (!with2025.ok) throw new Error('unreachable')
  const switched = applySwitchWorkingPeriod(with2025.state, '2025-26')
  assert(switched.ok, 'switch 2025-26')
  if (!switched.ok) throw new Error('unreachable')
  const workingIds = switched.state.periods.filter((p) => p.id === switched.state.workingPeriodId)
  assertEq(workingIds.length, 1, 'exactly one working id')
  assertEq(workingIds[0].name, '2025-26', 'working is 2025-26')
  console.log('[operational-period] only one working period')
}

// Default calendar period when none stored
{
  const seeded = ensureDefaultPeriodState(emptyState(), '2026-08-01')
  assertEq(seeded.periods.length, 1, 'auto current period')
  assertEq(seeded.periods[0].name, '2026-27', 'auto 2026-27 from August')
  assertEq(seeded.workingPeriodId, seeded.periods[0].id, 'auto working')
}

// Create does not destroy old periods
{
  const before = JSON.stringify(state.periods)
  const added = applyCreatePeriod(state, {
    name: '2029-30',
    startDate: '2029-04-01',
    endDate: '2030-03-31',
  })
  assert(added.ok, 'create extra period')
  if (!added.ok) throw new Error('unreachable')
  assert(added.state.periods.some((p) => p.name === '2026-27'), 'old 2026-27 kept')
  assert(added.state.periods.some((p) => p.name === '2027-28'), 'old 2027-28 kept')
  assertEq(
    JSON.stringify(state.periods),
    before,
    'create returns new state without mutating previous periods array contents by reference mutation of names',
  )
}

console.log('operational-period.selftest: ok')
