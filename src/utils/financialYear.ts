/**
 * Indian Financial Year helpers (1 April → 31 March).
 *
 * Examples:
 *   2026-03-31 → FY 2025-26
 *   2026-04-01 → FY 2026-27
 */

export type DateInput = Date | string | number | null | undefined

/** Parse a business date; date-only strings (YYYY-MM-DD) use local calendar days. */
export function parseBusinessDate(input?: DateInput): Date {
  if (input == null || input === '') return new Date()
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return new Date()
    return new Date(input.getFullYear(), input.getMonth(), input.getDate())
  }
  if (typeof input === 'number') {
    const d = new Date(input)
    if (Number.isNaN(d.getTime())) return new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const s = String(input).trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Calendar year in which the FY begins (April of that year). */
export function getFinancialYearStartYear(date?: DateInput): number {
  const d = parseBusinessDate(date)
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
}

/** Parse a period name such as "2026-27" or "26-27". */
export function parsePeriodName(raw: string): {
  startYear: number
  name: string
  short: string
} | null {
  const s = String(raw || '').trim()
  const full = /^(20\d{2})-(\d{2})$/.exec(s)
  if (full) {
    const startYear = Number(full[1])
    const endYy = Number(full[2])
    if ((startYear + 1) % 100 !== endYy) return null
    return {
      startYear,
      name: `${startYear}-${full[2]}`,
      short: `${String(startYear).slice(-2)}-${full[2]}`,
    }
  }
  const compact = /^(\d{2})-(\d{2})$/.exec(s)
  if (compact) {
    const startYy = Number(compact[1])
    const endYy = Number(compact[2])
    if ((startYy + 1) % 100 !== endYy) return null
    const startYear = 2000 + startYy
    return {
      startYear,
      name: `${startYear}-${compact[2]}`,
      short: `${compact[1]}-${compact[2]}`,
    }
  }
  return null
}

/** Default Indian FY dates for a period name: 01-Apr → 31-Mar. */
export function datesForPeriodName(name: string): { start: string; end: string } | null {
  const parsed = parsePeriodName(name)
  if (!parsed) return null
  return {
    start: `${parsed.startYear}-04-01`,
    end: `${parsed.startYear + 1}-03-31`,
  }
}

/** "2026-27" */
export function getFinancialYear(date?: DateInput): string {
  if (typeof date === 'string') {
    const named = parsePeriodName(date)
    if (named) return named.name
  }
  const start = getFinancialYearStartYear(date)
  return `${start}-${String(start + 1).slice(-2)}`
}

/** "2026-04-01" */
export function getFinancialYearStart(date?: DateInput): string {
  const start = getFinancialYearStartYear(date)
  return `${start}-04-01`
}

/** "2027-03-31" */
export function getFinancialYearEnd(date?: DateInput): string {
  const start = getFinancialYearStartYear(date)
  return `${start + 1}-03-31`
}

/** "FY 2026-27" */
export function getFinancialYearLabel(date?: DateInput): string {
  return `FY ${getFinancialYear(date)}`
}

/** "26-27" */
export function getFinancialYearShort(date?: DateInput): string {
  if (typeof date === 'string') {
    const named = parsePeriodName(date)
    if (named) return named.short
  }
  const start = getFinancialYearStartYear(date)
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`
}

/** Display an ISO date as DD-MM-YYYY. */
export function formatDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!m) return String(iso || '')
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** Apr→Mar month labels for charts. */
export const FY_MONTH_LABELS = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
] as const

export type FyMonthBucket = {
  label: (typeof FY_MONTH_LABELS)[number]
  year: number
  monthIndex: number
  from: Date
  to: Date
}

/** Twelve calendar-month buckets for the FY containing `date`. */
export function getFinancialYearMonthBuckets(date?: DateInput): FyMonthBucket[] {
  const fyStartYear = getFinancialYearStartYear(date)
  return FY_MONTH_LABELS.map((label, i) => {
    const monthIndex = (i + 3) % 12
    const year = i < 9 ? fyStartYear : fyStartYear + 1
    return {
      label,
      year,
      monthIndex,
      from: new Date(year, monthIndex, 1),
      to: new Date(year, monthIndex + 1, 0),
    }
  })
}

export function isDateInFinancialYear(date: DateInput, fyOrDate: string | DateInput): boolean {
  const target =
    typeof fyOrDate === 'string' && /^\d{4}-\d{2}$/.test(fyOrDate)
      ? fyOrDate
      : getFinancialYear(fyOrDate)
  return getFinancialYear(date) === target
}

/** Inclusive ISO date range for an FY ("2026-27" or any date in that FY). */
export function getFinancialYearRange(dateOrFy?: DateInput | string): {
  start: string
  end: string
  fy: string
} {
  if (typeof dateOrFy === 'string' && /^\d{4}-\d{2}$/.test(dateOrFy)) {
    const startYear = Number(dateOrFy.slice(0, 4))
    return {
      fy: dateOrFy,
      start: `${startYear}-04-01`,
      end: `${startYear + 1}-03-31`,
    }
  }
  const d = dateOrFy as DateInput
  return {
    fy: getFinancialYear(d),
    start: getFinancialYearStart(d),
    end: getFinancialYearEnd(d),
  }
}

export function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
