/**
 * Fire Assay sheet presentation helpers.
 * Does not change CG values, Manak mapping, or assay chemistry.
 */

import { finenessPpt } from './fireAssayBis'
import type { ManakFireAssayRow, ManakFireAssaySheet } from './manakFireAssayBridge'

export function manakJobCardOf(raw: string) {
  return String(raw || '')
    .replace(/^\d+[_\-/]/, '')
    .trim()
}

/**
 * Required order: CG Weight 1 → sample rows → CG Weight 2.
 * Locked control rows use keys `cg1` / `cg2`.
 */
export function arrangeFireAssayPresentation<T extends { key: string }>(rows: T[]): T[] {
  const cg1 = rows.find((r) => r.key === 'cg1')
  const cg2 = rows.find((r) => r.key === 'cg2')
  const samples = rows.filter((r) => r.key !== 'cg1' && r.key !== 'cg2')
  if (!cg1 && !cg2) return rows
  const out: T[] = []
  if (cg1) out.push(cg1)
  out.push(...samples)
  if (cg2) out.push(cg2)
  return out
}

type FireAssayPrintableRow = {
  jobCardNo?: string | null
}

function hasPrintableFireAssayJobCard(jobCardNo: unknown): boolean {
  return String(jobCardNo ?? '').trim() !== ''
}

/**
 * Print/PDF only: keep rows that have a Job Card Number.
 * Empty unused slots (no Job Card) are omitted. Secondary fields are ignored.
 * Does not mutate, reorder, or recalculate the source rows.
 */
export function getPrintableFireAssayRows<T extends FireAssayPrintableRow>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => hasPrintableFireAssayJobCard(r.jobCardNo))
}

/**
 * Native Print Preview and Save as PDF must render this same filtered list.
 * There is one filter and one report markup — not a separate on-screen preview.
 */
export function getFireAssayPreviewAndPrintRows<T extends FireAssayPrintableRow>(
  rows: readonly T[],
): { previewRows: T[]; printRows: T[] } {
  const filtered = getPrintableFireAssayRows(rows)
  return { previewRows: filtered, printRows: filtered }
}

/** BIS Fire Assay Sheet document-control header (Format F-25). Not assay chemistry. */
export const FIRE_ASSAY_SHEET_FORMAT = {
  formatNo: 'F-25',
  issueNo: '01',
  revisionNo: '00',
  preparedBy: 'QM',
  approvedBy: 'TM',
  issuedBy: 'QM',
  issueDate: '01.04.2023',
} as const

/** Display date on the F-25 sheet as DD-MM-YYYY. */
export function formatFireAssayReportDate(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`
  return s
}

/**
 * CG control-row display: gold-cornet column is WOTGCAA of check gold.
 * Copper stays on sheet.cg for Manak and is never shown as gold cornet.
 */
export function mapCgToViewFields(
  cg: ManakFireAssaySheet['cg'] | undefined,
  which: 1 | 2,
): {
  sampleDrawn: string
  sampleWeight: string
  silver: string
  lead: string
  wotgcaa: string
  fineness: string
  meanFineness: string
  copper: number
} {
  const wt = which === 1 ? cg?.cg1 : cg?.cg2
  const wotgcaa = which === 1 ? cg?.wotgcaa1 : cg?.wotgcaa2
  const silver = which === 1 ? cg?.silverCg1 : cg?.silverCg2
  const lead = which === 1 ? cg?.leadCg1 : cg?.leadCg2
  const delta = which === 1 ? cg?.delta1 : cg?.delta2
  const copper = which === 1 ? cg?.copperCg1 : cg?.copperCg2
  const cgWt = Number(wt) || 0
  const gold = Number(wotgcaa) || 0
  return {
    sampleDrawn: cgWt ? String(wt) : '',
    sampleWeight: cgWt ? String(wt) : '',
    silver: silver ? String(silver) : '',
    lead: lead != null && lead !== undefined ? String(lead) : '',
    wotgcaa: gold ? String(wotgcaa) : '',
    fineness: cgWt && gold ? finenessPpt(cgWt, gold).toFixed(3) : '',
    meanFineness: delta != null && delta !== undefined ? String(delta) : '',
    copper: Number(copper) || 0,
  }
}

export function formatFinenessCell(value: unknown): string {
  if (value == null || value === '') return ''
  const raw = String(value).trim()
  if (!raw) return ''
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (n === 0) return ''
  return n.toFixed(3)
}

/** Assay fineness is valid only when it is a finite millesimal value above zero. */
export function isValidAssayFineness(value: unknown): boolean {
  if (value == null || value === '') return false
  const n = Number(String(value).trim())
  return Number.isFinite(n) && n > 0
}

/**
 * Sample fineness cell: blank when WOTGCAA or sample weight is missing/invalid.
 * Optional avgDelta is the proof correction applied once via finenessPpt.
 */
export function finenessFromMasses(
  sampleWeight: unknown,
  wotgcaa: unknown,
  avgDelta: unknown = 0,
): string {
  const sw = Number(sampleWeight)
  const w = Number(wotgcaa)
  const d = Number(avgDelta) || 0
  if (!(sw > 0) || !(w > 0)) return ''
  const f = finenessPpt(sw, w, d)
  return f > 0 ? f.toFixed(3) : ''
}

/**
 * Pair Mean Fineness: arithmetic mean only when both samples have valid fineness.
 * Empty or partial pairs stay blank (never 0 / 0.0 / 0.000).
 * First row keeps the existing 0.0 pair-layout marker only when both are valid.
 */
export function pairMeanFineness(
  finenessA: unknown,
  finenessB: unknown,
): { first: string; second: string } {
  if (!isValidAssayFineness(finenessA) || !isValidAssayFineness(finenessB)) {
    return { first: '', second: '' }
  }
  return {
    first: '0.0',
    second: ((Number(finenessA) + Number(finenessB)) / 2).toFixed(3),
  }
}

type ViewMapRow = {
  jobCardNo: string
  sampleDrawn: string
  sampleWeight: string
  silver: string
  lead: string
  wotgcaa: string
  fineness: string
  meanFineness: string
  lotNo?: number
}

/** Latest edited View Fire Assay rows → existing Manak row shape (same field names). */
export function mapViewRowsToManakRows(
  dataRows: ViewMapRow[],
  previousRows: ManakFireAssayRow[],
): ManakFireAssayRow[] {
  const byJobCard = new Map(
    previousRows.filter((r) => r.jobCardNo).map((r) => [manakJobCardOf(r.jobCardNo), r]),
  )
  return dataRows.map((r, i) => {
    const card = manakJobCardOf(r.jobCardNo)
    const from = byJobCard.get(card)
    return {
      lotNo: r.lotNo || Math.floor(i / 2) + 1,
      jobCardNo: r.jobCardNo,
      manakJobCard: card,
      sampleDrawn: Number(r.sampleDrawn) || 0,
      sampleWeight: Number(r.sampleWeight) || 0,
      silver: Number(r.silver) || 0,
      copper: from?.copper ?? 0,
      lead: Number(r.lead) || 4,
      wotgcaa: Number(r.wotgcaa) || 0,
      fineness: Number(r.fineness) || 0,
      meanFineness: Number(r.meanFineness) || 0,
      partyName: from?.partyName,
      requestNo: from?.requestNo,
    }
  })
}
