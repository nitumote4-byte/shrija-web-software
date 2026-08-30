import { tenantGet, tenantSet } from './tenant'

export const MANAK_FIRE_ASSAY_KEY = 'shrija-manak-fire-assay-sheet'
export const MANAK_FIRE_ASSAY_EVENT = 'shrija:manak-fire-assay-sheet'
export const FIRE_ASSAY_SHEETS_KEY = 'shrija-fire-assay-sheets-archive'

export type ManakFireAssayRow = {
  lotNo: number
  /** Full entry as typed in Shrija, e.g. 1_127087789 */
  jobCardNo: string
  /** Numeric Manak job card only, e.g. 127087789 — used for Lot dropdown match */
  manakJobCard: string
  sampleDrawn: number
  sampleWeight: number
  silver: number
  copper: number
  lead: number
  wotgcaa: number
  fineness: number
  meanFineness: number
  partyName?: string
  requestNo?: string
}

export type ManakFireAssaySheet = {
  version: 1
  source: 'shrija-hallmark-suite'
  createdAt: string
  /** Calendar day (YYYY-MM-DD). Optional on historical records — see fireAssaySheetDate. */
  date?: string
  purity: string
  shift: string
  sheetNo: string
  assayType: string
  cg: {
    cg1Id?: number
    cg2Id?: number
    cg1: number
    cg2: number
    silverCg1: number
    silverCg2: number
    copperCg1: number
    copperCg2: number
    leadCg1: number
    leadCg2: number
    wotgcaa1: number
    wotgcaa2: number
    delta1: number
    delta2: number
    avgDelta: number
  }
  /** Filled lots only — used by Manak extension */
  rows: ManakFireAssayRow[]
  /** Full grid (e.g. 22 rows) for View Fire Assay */
  viewRows?: ManakFireAssayRow[]
}

/** YYYY-MM-DD from a date picker, stored `date`, or ISO `createdAt`. */
export function fireAssayCalendarDate(raw?: string | null): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw || '').trim())
  return m ? m[1] : ''
}

/** Effective Fire Assay calendar day already used by the app (date field, else createdAt). */
export function fireAssaySheetDate(
  sheet: Pick<ManakFireAssaySheet, 'createdAt'> & { date?: string },
): string {
  return fireAssayCalendarDate(sheet.date) || fireAssayCalendarDate(sheet.createdAt)
}

export function todayFireAssayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Legacy identity: purity|shift|sheetNo (pre date-wise numbering). */
function legacySheetArchiveKey(purity: string, shift: string, sheetNo: string) {
  return `${purity}|${shift || 'Day'}|${sheetNo}`
}

/** Date-wise identity: date|purity|shift|sheetNo so 30-Aug/1 and 31-Aug/1 can both exist. */
function datedSheetArchiveKey(date: string, purity: string, shift: string, sheetNo: string) {
  return `${date}|${purity}|${shift || 'Day'}|${sheetNo}`
}

export function listFireAssaySheetNosFrom(
  sheets: Iterable<ManakFireAssaySheet>,
  purity?: string,
  shift?: string,
  date?: string,
): string[] {
  const day = fireAssayCalendarDate(date)
  const nos = new Set<string>()
  for (const s of sheets) {
    if (purity && s.purity !== purity) continue
    if (shift && s.shift !== shift) continue
    if (day && fireAssaySheetDate(s) !== day) continue
    if (s.sheetNo) nos.add(s.sheetNo)
  }
  return [...nos].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
}

export function nextSheetNoAfter(existingNos: string[]): string {
  const existing = existingNos
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!existing.length) return '1'
  return String(Math.max(...existing) + 1)
}

/**
 * Sheet Number dropdown: saved numbers for the selected date + exactly one next number.
 * Labels are the number only — no "(saved)" / "(new)", no unused future slots.
 */
export function fireAssaySheetSelectOptions(
  savedNos: string[],
  nextNew: string,
): { value: string; label: string }[] {
  const saved = savedNos.map((n) => String(n).trim()).filter(Boolean)
  const savedSet = new Set(saved)
  let next = String(nextNew || '').trim()
  if (!next || savedSet.has(next)) next = nextSheetNoAfter(saved)
  savedSet.add(next)
  return [...savedSet]
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
    .map((n) => ({ value: n, label: n }))
}

export function lookupFireAssaySheet(
  map: Record<string, ManakFireAssaySheet>,
  purity: string,
  shift: string,
  sheetNo: string,
  date?: string,
): ManakFireAssaySheet | null {
  if (!purity || !sheetNo) return null
  const sh = shift || 'Day'
  const day = fireAssayCalendarDate(date)
  if (day) {
    const dated = map[datedSheetArchiveKey(day, purity, sh, sheetNo)]
    if (dated) return dated
    const legacy = map[legacySheetArchiveKey(purity, sh, sheetNo)]
    if (legacy && fireAssaySheetDate(legacy) === day) return legacy
    return null
  }
  return map[legacySheetArchiveKey(purity, sh, sheetNo)] || null
}

/**
 * Choose archive key without migrating historical records.
 * Same date under the legacy key stays on that key; a new date gets a dated key
 * so it cannot overwrite another day's sheet with the same number.
 */
export function fireAssayArchiveWriteKey(
  map: Record<string, ManakFireAssaySheet>,
  sheet: ManakFireAssaySheet,
): string {
  const date = fireAssaySheetDate(sheet)
  const datedKey = date
    ? datedSheetArchiveKey(date, sheet.purity, sheet.shift, sheet.sheetNo)
    : ''
  const legacyKey = legacySheetArchiveKey(sheet.purity, sheet.shift, sheet.sheetNo)
  if (datedKey && map[datedKey]) return datedKey
  const legacy = map[legacyKey]
  if (legacy && fireAssaySheetDate(legacy) === date) return legacyKey
  return datedKey || legacyKey
}

export function loadFireAssaySheetArchive(): Record<string, ManakFireAssaySheet> {
  try {
    const raw = tenantGet(FIRE_ASSAY_SHEETS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ManakFireAssaySheet>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveFireAssaySheetArchive(sheet: ManakFireAssaySheet) {
  const map = loadFireAssaySheetArchive()
  const key = fireAssayArchiveWriteKey(map, sheet)
  const prev = map[key]
  map[key] = prev
    ? {
        ...sheet,
        createdAt: prev.createdAt || sheet.createdAt,
        date: prev.date || sheet.date,
      }
    : sheet
  tenantSet(FIRE_ASSAY_SHEETS_KEY, JSON.stringify(map))
  return key
}

export function getFireAssaySheet(
  purity: string,
  shift: string,
  sheetNo: string,
  date?: string,
): ManakFireAssaySheet | null {
  return lookupFireAssaySheet(loadFireAssaySheetArchive(), purity, shift, sheetNo, date)
}

export function listFireAssaySheetNos(purity?: string, shift?: string, date?: string): string[] {
  return listFireAssaySheetNosFrom(Object.values(loadFireAssaySheetArchive()), purity, shift, date)
}

/** Next free sheet number for purity+shift+date (if that date has 1 → 2; empty date → 1). */
export function nextAvailableSheetNo(purity: string, shift = 'Day', date?: string): string {
  return nextSheetNoAfter(listFireAssaySheetNos(purity, shift, date))
}

/** Positive integer sheet id, or 0 if the raw value is not a real sheet number. */
export function parseFireAssaySheetNumber(raw: string | number | undefined | null): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

/**
 * Sheet number that NEW-SHEET row generation must use.
 * Pass the intended sheet (dropdown / New Sheet No) as `sheetNoOverride`.
 * When that is missing (purity select), use `nextAvailable` computed in the same tick —
 * do not read React `sheetNo` state, which has often not flushed yet and is `''` → 0.
 */
export function sheetNumberForNewSheetGeneration(
  sheetNoOverride: string | number | undefined | null,
  nextAvailable: string | number,
): number {
  const fromOverride = parseFireAssaySheetNumber(sheetNoOverride)
  if (fromOverride > 0) return fromOverride
  return parseFireAssaySheetNumber(nextAvailable)
}

export function fireAssaySheetExists(
  purity: string,
  shift: string,
  sheetNo: string,
  date?: string,
): boolean {
  return Boolean(getFireAssaySheet(purity, shift || 'Day', sheetNo, date))
}

export function publishManakFireAssaySheet(sheet: ManakFireAssaySheet) {
  saveFireAssaySheetArchive(sheet)
  const json = JSON.stringify(sheet)
  try {
    localStorage.setItem(MANAK_FIRE_ASSAY_KEY, json)
    sessionStorage.setItem(MANAK_FIRE_ASSAY_KEY, json)
    // Also mirror under plain key for older extension builds
    localStorage.setItem('shrija-manak-fire-assay-sheet-v1', json)
  } catch {
    /* ignore quota */
  }
  try {
    tenantSet(MANAK_FIRE_ASSAY_KEY, json)
  } catch {
    /* ignore */
  }

  // DOM bridge (shared with extension content script — CustomEvent does NOT cross isolated world)
  try {
    let el = document.getElementById('shrija-fire-assay-payload') as HTMLScriptElement | null
    if (!el) {
      el = document.createElement('script')
      el.id = 'shrija-fire-assay-payload'
      el.type = 'application/json'
      el.setAttribute('data-shrija-bridge', '1')
      document.documentElement.appendChild(el)
    }
    el.textContent = json
    el.setAttribute('data-updated', String(Date.now()))
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(new CustomEvent(MANAK_FIRE_ASSAY_EVENT, { detail: sheet }))
  } catch {
    /* ignore */
  }

  // postMessage — content script listens; repeat so late-injected scripts catch it
  const ping = () => {
    try {
      window.postMessage({ type: 'SHRIJA_MANAK_FIRE_ASSAY', sheet }, '*')
    } catch {
      /* ignore */
    }
  }
  ping()
  setTimeout(ping, 300)
  setTimeout(ping, 1000)
  setTimeout(ping, 2500)

  return sheet
}

export function readManakFireAssaySheet(): ManakFireAssaySheet | null {
  try {
    const raw =
      sessionStorage.getItem(MANAK_FIRE_ASSAY_KEY) ||
      localStorage.getItem(MANAK_FIRE_ASSAY_KEY) ||
      tenantGet(MANAK_FIRE_ASSAY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ManakFireAssaySheet
  } catch {
    return null
  }
}

export const MANAK_FIRE_ASSAY_URL =
  'https://huid.manakonline.in/MANAK/assayingAH_List?hmType=HMRD'
