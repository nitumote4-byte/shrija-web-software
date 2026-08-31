/**
 * Operational Financial Period — working FY context, switching, and isolation.
 * Date math stays in utils/financialYear.ts; this module owns stored periods.
 */
import { tenantGet, tenantSet } from './tenant'
import {
  datesForPeriodName,
  formatDisplayDate,
  getFinancialYear,
  getFinancialYearEnd,
  getFinancialYearShort,
  getFinancialYearStart,
  parseBusinessDate,
  parsePeriodName,
  formatIsoDate,
  type DateInput,
} from '../utils/financialYear'

export const OFP_CHANGE_EVENT = 'shrija-operational-period-change'
export const OFP_STORAGE_KEY = 'shrija-operational-periods'

export type OperationalPeriodStatus = 'working' | 'available'

export type OperationalPeriod = {
  id: string
  name: string
  startDate: string
  endDate: string
  status: OperationalPeriodStatus
  createdAt: string
}

export type OperationalPeriodState = {
  periods: Array<Omit<OperationalPeriod, 'status'>>
  workingPeriodId: string | null
}

export type PeriodTagged = {
  operationalPeriod?: string
  date?: string
  invoiceDateTime?: string
  month?: string
}

export type CreatePeriodInput = {
  name: string
  startDate: string
  endDate: string
}

export type PeriodValidationError =
  | 'invalid_name'
  | 'invalid_dates'
  | 'start_after_end'
  | 'duplicate'
  | 'overlap'

const EMPTY_STATE: OperationalPeriodState = { periods: [], workingPeriodId: null }

function isoDay(input: DateInput): string {
  return formatIsoDate(parseBusinessDate(input))
}

function periodId(name: string) {
  return `ofp-${name}`
}

function withStatus(state: OperationalPeriodState): OperationalPeriod[] {
  return [...state.periods]
    .sort((a, b) => b.name.localeCompare(a.name))
    .map((p) => ({
      ...p,
      status: p.id === state.workingPeriodId ? 'working' : 'available',
    }))
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}

export function validateNewPeriod(
  input: CreatePeriodInput,
  existing: Array<{ name: string; startDate: string; endDate: string; id?: string }>,
  opts?: { ignoreId?: string },
): { ok: true; name: string; startDate: string; endDate: string } | { ok: false; error: PeriodValidationError; message: string } {
  const parsed = parsePeriodName(input.name)
  if (!parsed) {
    return {
      ok: false,
      error: 'invalid_name',
      message: 'Period must look like 2026-27 (April start year, then next-year short).',
    }
  }
  const startDate = isoDay(input.startDate)
  const endDate = isoDay(input.endDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { ok: false, error: 'invalid_dates', message: 'Start and end dates are required.' }
  }
  if (startDate >= endDate) {
    return { ok: false, error: 'start_after_end', message: 'Start date must be before end date.' }
  }

  const others = opts?.ignoreId
    ? existing.filter((p) => p.id !== opts.ignoreId)
    : existing
  if (others.some((p) => parsePeriodName(p.name)?.name === parsed.name)) {
    return { ok: false, error: 'duplicate', message: `Period ${parsed.name} already exists.` }
  }
  const overlapping = others.find((p) => rangesOverlap(startDate, endDate, p.startDate, p.endDate))
  if (overlapping) {
    return {
      ok: false,
      error: 'overlap',
      message: `Dates overlap ${overlapping.name} (${formatDisplayDate(overlapping.startDate)} – ${formatDisplayDate(overlapping.endDate)}).`,
    }
  }
  return { ok: true, name: parsed.name, startDate, endDate }
}

export function calendarPeriodFromDate(date?: DateInput): Omit<OperationalPeriod, 'status'> {
  const name = getFinancialYear(date)
  const startDate = getFinancialYearStart(date)
  const endDate = getFinancialYearEnd(date)
  return {
    id: periodId(name),
    name,
    startDate,
    endDate,
    createdAt: new Date().toISOString(),
  }
}

export function ensureDefaultPeriodState(
  state: OperationalPeriodState,
  date?: DateInput,
): OperationalPeriodState {
  if (state.periods.length > 0) {
    const working =
      state.workingPeriodId && state.periods.some((p) => p.id === state.workingPeriodId)
        ? state.workingPeriodId
        : pickWorkingId(state.periods, date)
    return { periods: state.periods, workingPeriodId: working }
  }
  const created = calendarPeriodFromDate(date)
  return { periods: [created], workingPeriodId: created.id }
}

function pickWorkingId(periods: OperationalPeriodState['periods'], date?: DateInput) {
  const todayIso = isoDay(date)
  const containing = periods.find((p) => p.startDate <= todayIso && todayIso <= p.endDate)
  if (containing) return containing.id
  const named = parsePeriodName(getFinancialYear(date))
  const byName = named ? periods.find((p) => p.name === named.name) : undefined
  if (byName) return byName.id
  return [...periods].sort((a, b) => b.name.localeCompare(a.name))[0]?.id ?? null
}

export function applyCreatePeriod(
  state: OperationalPeriodState,
  input: CreatePeriodInput,
):
  | { ok: true; state: OperationalPeriodState; period: OperationalPeriod }
  | { ok: false; error: PeriodValidationError; message: string } {
  const checked = validateNewPeriod(input, state.periods)
  if (!checked.ok) return checked
  const period = {
    id: periodId(checked.name),
    name: checked.name,
    startDate: checked.startDate,
    endDate: checked.endDate,
    createdAt: new Date().toISOString(),
  }
  const next: OperationalPeriodState = {
    periods: [...state.periods, period],
    workingPeriodId: state.workingPeriodId || period.id,
  }
  return {
    ok: true,
    state: next,
    period: { ...period, status: period.id === next.workingPeriodId ? 'working' : 'available' },
  }
}

export function applySwitchWorkingPeriod(
  state: OperationalPeriodState,
  periodIdOrName: string,
):
  | { ok: true; state: OperationalPeriodState; period: OperationalPeriod }
  | { ok: false; message: string } {
  const ensured = ensureDefaultPeriodState(state)
  const named = parsePeriodName(periodIdOrName)
  const found = ensured.periods.find(
    (p) => p.id === periodIdOrName || p.name === named?.name || p.name === periodIdOrName,
  )
  if (!found) return { ok: false, message: 'That Operational Financial Period was not found.' }
  const next: OperationalPeriodState = { ...ensured, workingPeriodId: found.id }
  return { ok: true, state: next, period: { ...found, status: 'working' } }
}

export function recordPeriodName(record: PeriodTagged, fallbackDate?: DateInput): string {
  const tagged = parsePeriodName(String(record.operationalPeriod || ''))
  if (tagged) return tagged.name
  if (record.date) return getFinancialYear(record.date)
  if (record.invoiceDateTime) return getFinancialYear(record.invoiceDateTime)
  if (record.month) return getFinancialYear(record.month)
  return getFinancialYear(fallbackDate)
}

export function recordBelongsToPeriod(record: PeriodTagged, periodName: string): boolean {
  const target = parsePeriodName(periodName)?.name || periodName
  return recordPeriodName(record) === target
}

export function workingPeriodShort(period: { name: string } | null | undefined): string {
  if (!period) return getFinancialYearShort()
  return getFinancialYearShort(period.name)
}

export function suggestedDatesForName(name: string): { startDate: string; endDate: string } | null {
  const dates = datesForPeriodName(name)
  if (!dates) return null
  return { startDate: dates.start, endDate: dates.end }
}

function readState(): OperationalPeriodState {
  try {
    const raw = tenantGet(OFP_STORAGE_KEY)
    if (!raw) return { ...EMPTY_STATE }
    const parsed = JSON.parse(raw) as OperationalPeriodState
    if (!parsed || !Array.isArray(parsed.periods)) return { ...EMPTY_STATE }
    return {
      periods: parsed.periods.map((p) => ({
        id: String(p.id || periodId(p.name)),
        name: String(p.name || ''),
        startDate: String(p.startDate || ''),
        endDate: String(p.endDate || ''),
        createdAt: String(p.createdAt || new Date().toISOString()),
      })),
      workingPeriodId: parsed.workingPeriodId || null,
    }
  } catch {
    return { ...EMPTY_STATE }
  }
}

function persist(state: OperationalPeriodState) {
  tenantSet(OFP_STORAGE_KEY, JSON.stringify(state))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFP_CHANGE_EVENT))
  }
}

function loadEnsuredState(): OperationalPeriodState {
  const raw = readState()
  const state = ensureDefaultPeriodState(raw)
  if (raw.periods.length !== state.periods.length || raw.workingPeriodId !== state.workingPeriodId) {
    persist(state)
  }
  return state
}

export function listOperationalPeriods(): OperationalPeriod[] {
  return withStatus(loadEnsuredState())
}

export function getWorkingPeriod(): OperationalPeriod {
  const listed = listOperationalPeriods()
  return listed.find((p) => p.status === 'working') || listed[0]
}

export function getWorkingPeriodName(): string {
  return getWorkingPeriod().name
}

export function isCalendarCurrentPeriod(period?: { name: string; startDate?: string; endDate?: string } | null) {
  if (!period) return true
  const calendar = getFinancialYear()
  return period.name === calendar
}

export function createOperationalPeriod(input: CreatePeriodInput) {
  const result = applyCreatePeriod(readState(), input)
  if (!result.ok) return result
  persist(result.state)
  return result
}

export function switchWorkingPeriod(periodIdOrName: string) {
  const result = applySwitchWorkingPeriod(readState(), periodIdOrName)
  if (!result.ok) return result
  persist(result.state)
  return result
}

export function workingPeriodStamp(): { operationalPeriod: string } {
  return { operationalPeriod: getWorkingPeriodName() }
}
