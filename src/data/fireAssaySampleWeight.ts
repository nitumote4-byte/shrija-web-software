/**
 * Authoritative Sample Weight for a Job Card:
 * Fire Assay Sheet → exact Job Number → that job's sample rows → sum of sampleWeight.
 *
 * Tenant isolation comes from loadFireAssaySheetArchive() (JWT-scoped KV).
 * Exact job matching uses the same lot-prefix rule as day-sheet / cornet sync.
 * This module does not change Fire Assay calculations or sheet layout.
 */

import {
  loadFireAssaySheetArchive,
  type ManakFireAssayRow,
  type ManakFireAssaySheet,
} from './manakFireAssayBridge'

export type FireAssaySampleWeightStatus = 'ready' | 'pending' | 'incomplete'

export type FireAssaySampleWeightResult = {
  status: FireAssaySampleWeightStatus
  total: number | null
  sample1: number | null
  sample2: number | null
  samples: number[]
}

const PENDING: FireAssaySampleWeightResult = {
  status: 'pending',
  total: null,
  sample1: null,
  sample2: null,
  samples: [],
}

/** Same canonical Job Card key as store.normalizeJobCardKey (lot prefix stripped). */
export function canonicalJobCardNo(raw: string | undefined | null): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  const lotPrefixed = /^\d+\s*[_\-/]\s*(.+)$/.exec(value)
  return (lotPrefixed ? lotPrefixed[1] : value).trim().toLowerCase()
}

export function parseFireAssaySampleWeight(raw: unknown): number | null {
  if (raw === '' || raw == null) return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return null
  return n
}

/**
 * Sheet / Manak sample weights are milligrams when >= 5 (see sampleDrawnMgFromRequest).
 * Request screens store grams. Convert only by that existing unit convention.
 */
export function fireAssaySheetTotalToRequestGrams(total: number): number {
  if (!Number.isFinite(total)) return total
  if (total >= 5) return Number((total / 1000).toFixed(3))
  return Number(total.toFixed(3))
}

export function totalFromFireAssaySamples(
  weights: Array<number | null | undefined>,
): FireAssaySampleWeightResult {
  const valid = weights.filter((w): w is number => w != null && Number.isFinite(w))
  if (valid.length === 0) return PENDING
  if (valid.length === 1) {
    return { status: 'incomplete', total: null, sample1: valid[0], sample2: null, samples: valid }
  }
  const sheetTotal = Number(valid.reduce((s, w) => s + w, 0).toFixed(3))
  return {
    status: 'ready',
    total: fireAssaySheetTotalToRequestGrams(sheetTotal),
    sample1: valid[0],
    sample2: valid[1],
    samples: valid,
  }
}

/** Actual unused mg = sample drawn − recorded Fire Assay sample weights. */
export function unusedSampleWeightMg(
  sampleDrawnMg: number,
  sampleWeights: Array<number | null | undefined>,
): number {
  const used = sampleWeights
    .map((w) => parseFireAssaySampleWeight(w))
    .filter((w): w is number => w != null && w > 0)
    .reduce((s, w) => s + w, 0)
  if (!(sampleDrawnMg > 0) || used <= 0) return 0
  return Number(Math.max(0, sampleDrawnMg - used).toFixed(3))
}

/** Billing / challan unused sample is grams (3 dp), matching other return weights. */
export function unusedSampleWeightGrams(unusedMg: number): number {
  if (!(unusedMg > 0)) return 0
  return Number((unusedMg / 1000).toFixed(3))
}

/** Fetch persisted Fire Assay unused sample from day-sheet rows. Does not recalculate. */
export function unusedSampleFromRoughRows(rows: Array<{ unusedSample?: number }>): number {
  return Number(rows.reduce((s, r) => s + (Number(r.unusedSample) || 0), 0).toFixed(3))
}

export type FireAssayLookupOpts = {
  requestNo?: string
  allowRequestNo?: (requestNo: string) => boolean
}

export type FireAssayCornetResult = {
  status: 'ready' | 'pending'
  total: number | null
}

const CORNET_PENDING: FireAssayCornetResult = { status: 'pending', total: null }

function rowJobKey(row: {
  jobCardNo?: string
  manakJobCard?: string
}): string {
  return canonicalJobCardNo(row.manakJobCard || row.jobCardNo)
}

function sheetSourceRows(sheet: ManakFireAssaySheet): ManakFireAssayRow[] {
  if (sheet.rows?.length) return sheet.rows
  return sheet.viewRows || []
}

function rowMatchesFireAssayLookup(
  row: { jobCardNo?: string; manakJobCard?: string; requestNo?: string },
  jobKey: string,
  opts?: FireAssayLookupOpts,
): boolean {
  if (rowJobKey(row) !== jobKey) return false
  // When both sides know a Request No, never cross that boundary (A must not get B).
  if (opts?.requestNo && row.requestNo && row.requestNo !== opts.requestNo) return false
  if (row.requestNo && opts?.allowRequestNo && !opts.allowRequestNo(row.requestNo)) return false
  return true
}

function newestSheetRowsForJob(
  jobCardNo: string,
  sheets: ManakFireAssaySheet[] = Object.values(loadFireAssaySheetArchive()),
): ManakFireAssayRow[] | null {
  const key = canonicalJobCardNo(jobCardNo)
  if (!key) return null
  const ordered = [...sheets].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  )
  for (const sheet of ordered) {
    const source = sheetSourceRows(sheet)
    if (source.some((r) => rowJobKey(r) === key)) return source
  }
  return null
}

export function fireAssaySampleWeightFromRows(
  rows: Array<{ jobCardNo?: string; manakJobCard?: string; sampleWeight?: unknown; requestNo?: string }>,
  jobCardNo: string,
  opts?: FireAssayLookupOpts,
): FireAssaySampleWeightResult {
  const key = canonicalJobCardNo(jobCardNo)
  if (!key) return PENDING
  const matched = rows.filter((r) => rowMatchesFireAssayLookup(r, key, opts))
  return totalFromFireAssaySamples(matched.map((r) => parseFireAssaySampleWeight(r.sampleWeight)))
}

/**
 * Current Fire Assay record for an exact Job Card: newest archived sheet that
 * contains that job (do not sum historical duplicate sheets).
 * Match key: canonical Job Card (lot prefix stripped). Request No is a
 * boundary when both the sheet row and the caller have one. Centre isolation
 * is `allowRequestNo` from the caller's outlet. Sheet number / date are not keys.
 */
export function fireAssaySampleWeightFromArchive(
  jobCardNo: string,
  opts?: FireAssayLookupOpts,
  sheets?: ManakFireAssaySheet[],
): FireAssaySampleWeightResult {
  const source = newestSheetRowsForJob(jobCardNo, sheets)
  if (!source) return PENDING
  return fireAssaySampleWeightFromRows(source, jobCardNo, opts)
}

/** Sum of WOTGCAA (mg) for an exact Job Card on the given sheet rows. */
export function fireAssayCornetFromRows(
  rows: Array<{ jobCardNo?: string; manakJobCard?: string; wotgcaa?: unknown; requestNo?: string }>,
  jobCardNo: string,
  opts?: FireAssayLookupOpts,
): FireAssayCornetResult {
  const key = canonicalJobCardNo(jobCardNo)
  if (!key) return CORNET_PENDING
  const total = rows
    .filter((r) => rowMatchesFireAssayLookup(r, key, opts))
    .reduce((s, r) => s + (Number(r.wotgcaa) || 0), 0)
  if (!(total > 0)) return CORNET_PENDING
  return { status: 'ready', total: Number(total.toFixed(3)) }
}

/**
 * Authoritative Cornet Weight (mg) from the same newest Fire Assay archive
 * sheet used for Sample Weight. Same Job Card / Request No / centre rules.
 */
export function fireAssayCornetFromArchive(
  jobCardNo: string,
  opts?: FireAssayLookupOpts,
  sheets?: ManakFireAssaySheet[],
): FireAssayCornetResult {
  const source = newestSheetRowsForJob(jobCardNo, sheets)
  if (!source) return CORNET_PENDING
  return fireAssayCornetFromRows(source, jobCardNo, opts)
}
