/** Sanitize XRF standard master + daily checks inside the store blob. */

type DuplicateMode = 'none' | 'same-date-time' | 'same-date'

function clampDecimals(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  return Math.min(4, Math.max(0, Math.round(n)))
}

function roundXrf(n: number, decimals: number): number {
  if (!Number.isFinite(n)) return 0
  const d = clampDecimals(decimals)
  if (d <= 0) return Math.round(n)
  const f = 10 ** d
  return Math.round((n + Number.EPSILON) * f) / f
}

function num(value: unknown): number | null {
  if (value === '' || value == null) return null
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function str(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeTime(raw: unknown): string {
  const s = str(raw)
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

function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function normalizeSettings(raw: unknown): {
  allowManualPurity: boolean
  duplicateMode: DuplicateMode
  valueDecimals: number
  standardsInitialized: boolean
} {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  let duplicateMode: DuplicateMode
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
    valueDecimals: clampDecimals(src.valueDecimals == null ? 1 : src.valueDecimals),
    standardsInitialized: Boolean(src.standardsInitialized),
  }
}

type AnyRecord = Record<string, unknown>

export function sanitizeXrfStorePayload(data: AnyRecord): void {
  const settings = normalizeSettings(data.xrfStandardSettings)
  data.xrfStandardSettings = settings
  const decimals = settings.valueDecimals

  const rawStandards = Array.isArray(data.xrfStandards) ? data.xrfStandards : []
  const standards = rawStandards
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null
      const r = row as AnyRecord
      const name = str(r.name)
      const purity = num(r.purity)
      const carat = num(r.carat)
      if (!name || purity == null || purity <= 0 || purity > 1000 || carat == null || carat <= 0 || carat > 24.9) {
        return null
      }
      return {
        id: str(r.id) || `xstdm-${index + 1}`,
        name,
        purity,
        carat,
        sortOrder: num(r.sortOrder) || index + 1,
      }
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
  data.xrfStandards = standards

  const byId = new Map(standards.map((s) => [s.id, s]))

  const rawChecks = Array.isArray(data.xrfStandardChecks) ? data.xrfStandardChecks : []
  data.xrfStandardChecks = rawChecks
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const r = row as AnyRecord
      const id = str(r.id)
      if (!id) return null
      const date = str(r.date)
      const time = normalizeTime(r.time)
      if (date && !isValidYmd(date)) return null
      const standardId = str(r.standardId)
      const master = standardId ? byId.get(standardId) : undefined
      const reading1 = num(r.reading1 ?? r.measuredValue)
      const reading2 = num(r.reading2 ?? r.measuredValue ?? r.reading1)
      if (reading1 == null || reading2 == null || reading1 < 0 || reading2 < 0) return null
      const purity = num(r.purity ?? r.expectedValue) ?? master?.purity ?? 0
      const carat = num(r.carat) ?? master?.carat ?? 0
      const centreKind = r.centreKind === 'osc' || r.centreKind === 'main' ? r.centreKind : undefined
      return {
        id,
        checkNo: str(r.checkNo),
        date,
        time,
        type: str(r.type) || 'Gold Dust',
        standardId: master?.id || standardId,
        standardName: str(r.standardName) || master?.name || '',
        purity,
        carat,
        reading1,
        reading2,
        average: roundXrf((reading1 + reading2) / 2, decimals),
        centreId: str(r.centreId) || undefined,
        centreKind,
      }
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
}
