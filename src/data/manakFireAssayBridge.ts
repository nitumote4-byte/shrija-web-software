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

function sheetArchiveKey(purity: string, shift: string, sheetNo: string) {
  return `${purity}|${shift || 'Day'}|${sheetNo}`
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
  const key = sheetArchiveKey(sheet.purity, sheet.shift, sheet.sheetNo)
  map[key] = sheet
  tenantSet(FIRE_ASSAY_SHEETS_KEY, JSON.stringify(map))
  return key
}

export function getFireAssaySheet(
  purity: string,
  shift: string,
  sheetNo: string,
): ManakFireAssaySheet | null {
  if (!purity || !sheetNo) return null
  const map = loadFireAssaySheetArchive()
  return map[sheetArchiveKey(purity, shift, sheetNo)] || null
}

export function listFireAssaySheetNos(purity?: string, shift?: string): string[] {
  const map = loadFireAssaySheetArchive()
  const nos = new Set<string>()
  for (const s of Object.values(map)) {
    if (purity && s.purity !== purity) continue
    if (shift && s.shift !== shift) continue
    if (s.sheetNo) nos.add(s.sheetNo)
  }
  return [...nos].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
}

export function publishManakFireAssaySheet(sheet: ManakFireAssaySheet) {
  saveFireAssaySheetArchive(sheet)
  const json = JSON.stringify(sheet)
  try {
    localStorage.setItem(MANAK_FIRE_ASSAY_KEY, json)
    sessionStorage.setItem(MANAK_FIRE_ASSAY_KEY, json)
  } catch {
    /* ignore quota */
  }
  try {
    tenantSet(MANAK_FIRE_ASSAY_KEY, json)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MANAK_FIRE_ASSAY_EVENT, { detail: sheet }))
  window.postMessage({ type: 'SHRIJA_MANAK_FIRE_ASSAY', sheet }, '*')
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
