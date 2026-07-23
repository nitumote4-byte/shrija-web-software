import { tenantGet, tenantSet } from './tenant'

export const MANAK_FIRE_ASSAY_KEY = 'shrija-manak-fire-assay-sheet'
export const MANAK_FIRE_ASSAY_EVENT = 'shrija:manak-fire-assay-sheet'

export type ManakFireAssayRow = {
  lotNo: number
  jobCardNo: string
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
  rows: ManakFireAssayRow[]
}

export function publishManakFireAssaySheet(sheet: ManakFireAssaySheet) {
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
  // Bridge for Chrome extension content script on Shrija origin
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
