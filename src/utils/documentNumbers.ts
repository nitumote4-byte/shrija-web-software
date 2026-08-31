/**
 * FY-aware document numbering.
 * Sequences reset per Indian Financial Year (1 Apr → 31 Mar).
 * Existing stored numbers are never rewritten — only new numbers use these helpers.
 */

import {
  formatIsoDate,
  getFinancialYear,
  getFinancialYearShort,
  parseBusinessDate,
  parsePeriodName,
  type DateInput,
} from './financialYear'

export type NumberedDoc = {
  invoiceNo?: string
  date?: string
  invoiceDateTime?: string
  operationalPeriod?: string
  month?: string
}

/** True when the configured prefix already embeds a year / FY token. */
export function prefixIncludesYearToken(prefix: string): boolean {
  const p = String(prefix || '')
  return /\d{2}-\d{2}/.test(p) || /20\d{2}/.test(p)
}

function padSeq(seq: number, width = 3) {
  return String(Math.max(0, seq)).padStart(width, '0')
}

/**
 * Build `{prefix}{yy-yy}/{NNN}` unless prefix already contains a year token,
 * in which case `{prefix}{NNN}` (no duplicated FY).
 */
export function formatFySequence(
  prefix: string,
  fyShort: string,
  seq: number,
  opts?: { pad?: number },
): string {
  const padded = padSeq(seq, opts?.pad ?? 3)
  const p = String(prefix || '')
  if (prefixIncludesYearToken(p)) return `${p}${padded}`
  return `${p}${fyShort}/${padded}`
}

export function documentBusinessDate(doc: {
  date?: string
  invoiceDateTime?: string
  month?: string
}): string {
  if (doc.date && /^\d{4}-\d{2}-\d{2}/.test(doc.date)) return doc.date.slice(0, 10)
  if (doc.invoiceDateTime && /^\d{4}-\d{2}-\d{2}/.test(doc.invoiceDateTime)) {
    return doc.invoiceDateTime.slice(0, 10)
  }
  if (doc.month && /^\d{4}-\d{2}/.test(doc.month)) return `${doc.month.slice(0, 7)}-01`
  return formatIsoDate(parseBusinessDate())
}

export function isCreditNoteInvoiceNo(invoiceNo?: string): boolean {
  return String(invoiceNo || '')
    .trim()
    .toUpperCase()
    .startsWith('CN')
}

export function resolveNumberingPeriod(date: DateInput, periodName?: string): string {
  if (periodName) {
    const named = parsePeriodName(periodName)
    if (named) return named.name
  }
  return getFinancialYear(date)
}

export function documentPeriodName(doc: {
  operationalPeriod?: string
  date?: string
  invoiceDateTime?: string
  month?: string
}): string {
  const tagged = parsePeriodName(String(doc.operationalPeriod || ''))
  if (tagged) return tagged.name
  return getFinancialYear(documentBusinessDate(doc))
}

/** Count documents that belong to the same Operational Financial Period as `date` / `periodName`. */
export function countInFinancialYear<
  T extends { date?: string; invoiceDateTime?: string; month?: string; operationalPeriod?: string },
>(items: T[], date: DateInput, predicate?: (item: T) => boolean, periodName?: string): number {
  const fy = resolveNumberingPeriod(date, periodName)
  return items.filter((item) => {
    if (predicate && !predicate(item)) return false
    return documentPeriodName(item) === fy
  }).length
}

export function nextSequenceInFinancialYear<
  T extends { date?: string; invoiceDateTime?: string; month?: string; operationalPeriod?: string },
>(
  items: T[],
  date: DateInput,
  startFrom: number | string,
  predicate?: (item: T) => boolean,
  periodName?: string,
): number {
  const start = Number(startFrom)
  const base = Number.isFinite(start) && start > 0 ? start : 1
  return base + countInFinancialYear(items, date, predicate, periodName)
}

/**
 * Regular (non-CN) invoice number for a bill date.
 * Empty prefix → `26-27/001`
 * Prefix `VH/` → `VH/26-27/001`
 */
export function nextInvoiceNo(opts: {
  prefix: string
  startFrom: string | number
  invoices: NumberedDoc[]
  date: DateInput
  /** Working Operational Financial Period name, e.g. "2026-27" */
  periodName?: string
}): string {
  const period = resolveNumberingPeriod(opts.date, opts.periodName)
  const seq = nextSequenceInFinancialYear(
    opts.invoices,
    opts.date,
    opts.startFrom,
    (inv) => !isCreditNoteInvoiceNo(inv.invoiceNo),
    period,
  )
  return formatFySequence(opts.prefix || '', getFinancialYearShort(period), seq)
}

/**
 * Monthly consolidated invoice number.
 * Empty prefix → `M-26-27/001`
 * Prefix `VH/` → `VH/M-26-27/001`
 */
export function nextMonthlyInvoiceNo(opts: {
  prefix: string
  startFrom: string | number
  monthlyInvoices: NumberedDoc[]
  date: DateInput
  periodName?: string
}): string {
  const period = resolveNumberingPeriod(opts.date, opts.periodName)
  const seq = nextSequenceInFinancialYear(
    opts.monthlyInvoices,
    opts.date,
    opts.startFrom,
    undefined,
    period,
  )
  const fyShort = getFinancialYearShort(period)
  const userPrefix = String(opts.prefix || '')
  if (prefixIncludesYearToken(userPrefix)) {
    return `${userPrefix}M-${padSeq(seq)}`
  }
  return `${userPrefix}M-${fyShort}/${padSeq(seq)}`
}

/**
 * Credit note number for a business month (YYYY-MM) or date.
 * → `CN-25-26/1`
 *
 * Valid FY-aware: `CN-YY-YY/N` (slash or hyphen before sequence digits).
 * Valid legacy: `CN-N` — counted only when month/date places it in the same FY.
 * Malformed FY-looking (`CN-25-26`, `CN-26-27`, `CN-25-26-ABC`) never contribute
 * a sequence (trailing digits from the FY token are not treated as a sequence).
 */
export function nextCreditNoteNo(opts: {
  existing: Array<{
    cnNo?: string
    invoiceNo?: string
    month?: string
    date?: string
    operationalPeriod?: string
  }>
  /** YYYY-MM or full date — determines FY unless periodName is set */
  monthOrDate: DateInput
  periodName?: string
}): string {
  const fy = resolveNumberingPeriod(opts.monthOrDate, opts.periodName)
  const fyShort = getFinancialYearShort(fy)
  const nums: number[] = []
  for (const row of opts.existing) {
    const raw = String(row.cnNo || row.invoiceNo || '').trim()
    if (!raw.toUpperCase().startsWith('CN')) continue
    const normalized = raw.replace(/\s/g, '').toUpperCase()

    // Valid FY-aware: CN-25-26/1 or CN-25-26-005
    const withFy = /^CN-?(\d{2}-\d{2})(?:\/|-)(\d+)$/.exec(normalized)
    if (withFy) {
      if (withFy[1] === fyShort) nums.push(Number(withFy[2]) || 0)
      continue
    }

    // Malformed FY-looking (missing/invalid sequence) — never scrape trailing digits
    if (/^CN-?\d{2}-\d{2}/.test(normalized)) {
      continue
    }

    // Legacy CN-123 — include only if we know its business month/date FY
    const legacy = /^CN-?(\d+)$/.exec(normalized)
    if (!legacy) continue
    const business = row.month || row.date
    if (business && documentPeriodName({ ...row, date: row.date, month: row.month }) === fy) {
      nums.push(Number(legacy[1]) || 0)
    }
  }
  const max = nums.length ? Math.max(...nums) : 0
  return `CN-${fyShort}/${max + 1}`
}

/**
 * Fallback / store generators: `HM-26-27-001`, `FA-26-27-001`, etc.
 * Sequence = count of existing docs whose business date is in the same FY + 1.
 * Historical numbers (e.g. HM-2026-001) are left unchanged; they only affect
 * the counter when their date falls in the target FY.
 */
export function nextKeyedDocumentNo(opts: {
  key: string
  existing: Array<{ no?: string; date?: string; operationalPeriod?: string }>
  date: DateInput
  periodName?: string
  pad?: number
}): string {
  const key = opts.key.replace(/-$/, '')
  const period = resolveNumberingPeriod(opts.date, opts.periodName)
  const fyShort = getFinancialYearShort(period)
  const count = countInFinancialYear(
    opts.existing.map((e) => ({ date: e.date, operationalPeriod: e.operationalPeriod })),
    opts.date,
    undefined,
    period,
  )
  return `${key}-${fyShort}-${padSeq(count + 1, opts.pad ?? 3)}`
}
