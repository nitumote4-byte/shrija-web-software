/** XRF Daily Standard Check — types, defaults, and validation. */

export const DEFAULT_XRF_TYPE = 'Gold Dust'
/** Fallback only. Live rounding uses Standard Master `valueDecimals`. */
export const DEFAULT_XRF_VALUE_DECIMALS = 1
export const XRF_VALUE_DECIMAL_OPTIONS = [1, 3] as const

export type XrfDuplicateMode = 'none' | 'same-date-time' | 'same-date'

export type XrfStandard = {
  id: string
  name: string
  /** Reference / certified purity value (e.g. 918.1) */
  purity: number
  carat: number
  sortOrder?: number
}

export type XrfStandardSettings = {
  /** When false, purity is always taken from Standard Master */
  allowManualPurity: boolean
  /**
   * Duplicate protection scope. Default `same-date` (one check per standard per day).
   * Can be changed in Standard Master if the workflow needs session-level or no blocking.
   */
  duplicateMode: XrfDuplicateMode
  /** Display/storage decimals for purity, readings, and average. */
  valueDecimals: number
  /** True once seed/defaults or any master edit has been applied. */
  standardsInitialized?: boolean
  /** @deprecated Migrated into `duplicateMode`. */
  preventDuplicateInSession?: boolean
}

/** Daily XRF machine standard-check record */
export type XrfStandardCheck = {
  id: string
  checkNo: string
  date: string
  time: string
  type: string
  standardId: string
  standardName: string
  purity: number
  carat: number
  reading1: number
  reading2: number
  average: number
  centreId?: string
  centreKind?: 'main' | 'osc'
}

export type XrfCheckFieldErrors = {
  date?: string
  time?: string
  type?: string
  standardId?: string
  purity?: string
  reading1?: string
  reading2?: string
}

export type XrfCheckSaveResult =
  | { ok: true; entry: XrfStandardCheck }
  | { ok: false; error: string; field?: keyof XrfCheckFieldErrors }

export const DEFAULT_XRF_STANDARD_SETTINGS: XrfStandardSettings = {
  allowManualPurity: false,
  duplicateMode: 'same-date',
  valueDecimals: DEFAULT_XRF_VALUE_DECIMALS,
  standardsInitialized: false,
}

/**
 * Seed/example standards only — not final business configuration.
 * Operators can add/edit/delete these in Standard Master without code changes.
 */
export const DEFAULT_XRF_STANDARDS: Omit<XrfStandard, 'id'>[] = [
  { name: '14 ct', purity: 593.3, carat: 14, sortOrder: 1 },
  { name: '18 ct', purity: 757.4, carat: 18, sortOrder: 2 },
  { name: '20 ct', purity: 837.9, carat: 20, sortOrder: 3 },
  { name: '22 ct', purity: 918.1, carat: 22, sortOrder: 4 },
  { name: '23 ct', purity: 963.8, carat: 23, sortOrder: 5 },
]

export function clampXrfDecimals(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_XRF_VALUE_DECIMALS
  return Math.min(4, Math.max(0, Math.round(n)))
}

export function normalizeXrfStandardSettings(
  raw?: Partial<XrfStandardSettings> | null,
): XrfStandardSettings {
  const src = raw || {}
  let duplicateMode: XrfDuplicateMode
  if (src.duplicateMode === 'none' || src.duplicateMode === 'same-date' || src.duplicateMode === 'same-date-time') {
    duplicateMode = src.duplicateMode
  } else if (src.preventDuplicateInSession === false) {
    duplicateMode = 'none'
  } else {
    duplicateMode = 'same-date'
  }
  return {
    allowManualPurity: Boolean(src.allowManualPurity),
    duplicateMode,
    valueDecimals: clampXrfDecimals(
      src.valueDecimals == null ? DEFAULT_XRF_VALUE_DECIMALS : src.valueDecimals,
    ),
    standardsInitialized: Boolean(src.standardsInitialized),
  }
}

export function roundXrfValue(n: number, decimals = DEFAULT_XRF_VALUE_DECIMALS): number {
  const d = clampXrfDecimals(decimals)
  if (!Number.isFinite(n)) return 0
  if (d <= 0) return Math.round(n)
  const f = 10 ** d
  return Math.round((n + Number.EPSILON) * f) / f
}

export function calcXrfAverage(
  reading1: number,
  reading2: number,
  decimals = DEFAULT_XRF_VALUE_DECIMALS,
): number {
  return roundXrfValue((reading1 + reading2) / 2, decimals)
}

export function formatXrfValue(n: number, decimals = DEFAULT_XRF_VALUE_DECIMALS): string {
  return roundXrfValue(n, decimals).toFixed(clampXrfDecimals(decimals))
}

export function formatXrfCarat(n: number, decimals = DEFAULT_XRF_VALUE_DECIMALS): string {
  return formatXrfValue(n, decimals).replace(/\.?0+$/, '') || '0'
}

export function xrfInputStep(decimals = DEFAULT_XRF_VALUE_DECIMALS): string {
  const d = clampXrfDecimals(decimals)
  if (d <= 0) return '1'
  return (1 / 10 ** d).toFixed(d)
}

export function parseXrfNumber(raw: unknown): number | null {
  if (raw === '' || raw == null) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const s = String(raw).trim().replace(/,/g, '')
  if (!s) return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function normalizeXrfTime(raw?: string | null): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i)
  if (ampm) {
    let h = Number(ampm[1])
    const min = Number(ampm[2])
    if (h < 1 || h > 12 || min > 59) return ''
    const ap = ampm[3].toUpperCase()
    if (ap === 'PM' && h < 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }
  const hm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!hm) return ''
  const h = Number(hm[1])
  const min = Number(hm[2])
  if (h > 23 || min > 59) return ''
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function isValidXrfTime(value: string): boolean {
  return Boolean(normalizeXrfTime(value))
}

export function formatXrfTimeDisplay(hhmm: string): string {
  const n = normalizeXrfTime(hhmm)
  if (!n) return '—'
  const [hs, ms] = n.split(':')
  let h = Number(hs)
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${ms} ${ap}`
}

export function formatXrfDateDisplay(ymd: string): string {
  if (!ymd) return '—'
  const parts = ymd.split('-')
  if (parts.length !== 3) return ymd
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

/** Legacy CRM-name heuristic only — not used as live business mapping. */
function inferCaratFromName(name: string): number {
  const n = name.toLowerCase()
  if (/\b23\b/.test(n) || n.includes('963')) return 23
  if (/\b22\b/.test(n) || n.includes('916') || n.includes('918')) return 22
  if (/\b20\b/.test(n) || n.includes('837')) return 20
  if (/\b18\b/.test(n) || n.includes('750') || n.includes('757')) return 18
  if (/\b14\b/.test(n) || n.includes('585') || n.includes('593')) return 14
  if (n.includes('999')) return 24
  return 0
}

export function defaultXrfStandards(): XrfStandard[] {
  return DEFAULT_XRF_STANDARDS.map((s, i) => ({
    id: `xstdm-${s.carat}`,
    name: s.name,
    purity: s.purity,
    carat: s.carat,
    sortOrder: s.sortOrder ?? i + 1,
  }))
}

export function normalizeXrfStandard(raw: Partial<XrfStandard> & { id?: string }, index = 0): XrfStandard | null {
  const name = String(raw.name || '').trim()
  const purity = parseXrfNumber(raw.purity)
  const carat = parseXrfNumber(raw.carat)
  if (!name || purity == null || purity <= 0 || carat == null || carat <= 0) return null
  return {
    id: String(raw.id || '').trim() || `xstdm-${index + 1}`,
    name,
    purity,
    carat,
    sortOrder: Number(raw.sortOrder) || index + 1,
  }
}

export function sortXrfStandards(rows: XrfStandard[]): XrfStandard[] {
  return [...rows].sort((a, b) => {
    const sa = Number(a.sortOrder) || 0
    const sb = Number(b.sortOrder) || 0
    if (sa !== sb) return sa - sb
    if (a.carat !== b.carat) return a.carat - b.carat
    return a.name.localeCompare(b.name)
  })
}

type LegacyXrfCheck = Partial<XrfStandardCheck> & {
  expectedValue?: number
  measuredValue?: number
  tolerance?: number
  deviation?: number
  result?: string
  machineId?: string
  checkedBy?: string
  remarks?: string
}

export function normalizeXrfStandardCheck(
  raw: LegacyXrfCheck & { id: string },
  decimals = DEFAULT_XRF_VALUE_DECIMALS,
): XrfStandardCheck {
  const reading1 = parseXrfNumber(raw.reading1 ?? raw.measuredValue) ?? 0
  const reading2 = parseXrfNumber(raw.reading2 ?? raw.measuredValue ?? raw.reading1) ?? 0
  const purity = parseXrfNumber(raw.purity ?? raw.expectedValue) ?? 0
  const carat =
    parseXrfNumber(raw.carat) ?? inferCaratFromName(String(raw.standardName || ''))
  return {
    id: raw.id,
    checkNo: String(raw.checkNo || '').trim(),
    date: String(raw.date || '').trim(),
    time: normalizeXrfTime(raw.time),
    type: String(raw.type || DEFAULT_XRF_TYPE).trim() || DEFAULT_XRF_TYPE,
    standardId: String(raw.standardId || '').trim(),
    standardName: String(raw.standardName || '').trim(),
    purity,
    carat: carat || 0,
    reading1,
    reading2,
    average: calcXrfAverage(reading1, reading2, decimals),
    centreId: raw.centreId,
    centreKind: raw.centreKind === 'osc' ? 'osc' : raw.centreKind === 'main' ? 'main' : undefined,
  }
}

function readingError(label: string, raw: unknown): string | undefined {
  if (raw === '' || raw == null) return `${label} is required`
  const n = parseXrfNumber(raw)
  if (n == null) return `${label} must be a valid number`
  if (n < 0) return `${label} cannot be negative`
  if (n === 0) return `${label} must be greater than 0`
  if (n > 1000) return `${label} cannot exceed 1000`
  return undefined
}

export function validateXrfCheckInput(input: {
  date?: string
  time?: string
  type?: string
  standardId?: string
  standardName?: string
  purity?: unknown
  reading1?: unknown
  reading2?: unknown
  requireStandard?: boolean
}): { ok: true } | { ok: false; errors: XrfCheckFieldErrors } {
  const errors: XrfCheckFieldErrors = {}
  const date = String(input.date || '').trim()
  const time = String(input.time || '').trim()
  const type = String(input.type || '').trim()
  const standardId = String(input.standardId || '').trim()
  const standardName = String(input.standardName || '').trim()

  if (!date) errors.date = 'Date is required'
  else if (!isValidYmd(date)) errors.date = 'Enter a valid date'

  if (!time) errors.time = 'Time is required'
  else if (!isValidXrfTime(time)) errors.time = 'Enter a valid time'

  if (!type) errors.type = 'Type is required'

  if (input.requireStandard !== false && !standardId && !standardName) {
    errors.standardId = 'Select a standard'
  }

  const purityErr = readingError('Purity / reference value', input.purity)
  if (purityErr) errors.purity = purityErr

  const r1 = readingError('Reading 1', input.reading1)
  if (r1) errors.reading1 = r1
  const r2 = readingError('Reading 2', input.reading2)
  if (r2) errors.reading2 = r2

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true }
}

export function sameXrfStandard(
  row: Pick<XrfStandardCheck, 'standardId' | 'standardName'>,
  candidate: { standardId?: string; standardName?: string },
) {
  const sid = String(candidate.standardId || '').trim().toLowerCase()
  const sname = String(candidate.standardName || '').trim().toLowerCase()
  if (sid && row.standardId && row.standardId.toLowerCase() === sid) return true
  if (sname && row.standardName.toLowerCase() === sname) return true
  return false
}

export function isDuplicateXrfStandard(
  rows: XrfStandardCheck[],
  candidate: { date: string; time: string; standardId?: string; standardName?: string },
  mode: XrfDuplicateMode = 'same-date',
  excludeId?: string,
) {
  if (mode === 'none') return false
  const candTime = normalizeXrfTime(candidate.time)
  return rows.some((r) => {
    if (excludeId && r.id === excludeId) return false
    if (r.date !== candidate.date) return false
    if (mode === 'same-date-time' && normalizeXrfTime(r.time) !== candTime) return false
    return sameXrfStandard(r, candidate)
  })
}

export function xrfDuplicateError(name: string, mode: XrfDuplicateMode): string {
  if (mode === 'same-date') return `${name} is already recorded for this date`
  return `${name} is already recorded for this date and time`
}
