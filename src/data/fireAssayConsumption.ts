/**
 * Fire assay material consumption.
 *
 * Create / overwrite sheet posts:
 * - QM / BIS chain usage (Ag return, Cu/Pb/acid/cupel usage)
 * - Lab used / in-assay books
 * - Lab gold CG usage and QM gold lab return
 *
 * QM CG pieces are marked used separately (`markCgWeightsUsed`).
 */
import {
  fireAssaySheetDate,
  type ManakFireAssaySheet,
} from './manakFireAssayBridge'
import { upsertChainUsage } from './qmStockChain'
import { upsertLabBook } from './labStockChain'
import { cupelDiameterMmForLeadG } from './fireAssayBis'
import {
  GOLD_LAB_KEY,
  LAB_GOLD_CG_KEY,
  LAB_BIS_GOLD_CG_KEY,
  loadGoldList,
  saveGoldList,
  upsertGoldLabEntry,
  type StockKind,
} from './stockLedger'

/** Parting: Acid No. 1 (20 ml) + Acid No. 2 (20 ml) per assay piece (IS 1418). */
export const ACID_LTR_PER_CUPEL = 0.04

export const BIS_GOLD_CORNET_KEY = 'shrija-qm-bis-gold-cornet'

export type FireAssaySheetUsage = {
  goldG: number
  goldCornetG: number
  silverG: number
  copperG: number
  copperMg: number
  leadG: number
  leadKg: number
  acidLtr: number
  cupelCount: number
}

function qty(n: number, digits = 6): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  const rounded = Number(n.toFixed(digits))
  return rounded > 0 ? rounded : 0
}

export function fireAssayConsumptionSheetKey(sheet: Pick<ManakFireAssaySheet, 'purity' | 'shift' | 'sheetNo'> & { date?: string; createdAt: string }): string {
  const date = fireAssaySheetDate(sheet) || 'undated'
  return `${date}|${sheet.purity}|${sheet.shift || 'Day'}|${sheet.sheetNo}`
}

function consumptionId(tag: string, sheetKey: string) {
  return `fa-${tag}-${sheetKey}`
}

export function fireAssaySheetUsage(sheet: ManakFireAssaySheet): FireAssaySheetUsage {
  const filled = (sheet.rows || []).filter((r) => String(r.jobCardNo || '').trim())
  const cg1 = Number(sheet.cg?.cg1) || 0
  const cg2 = Number(sheet.cg?.cg2) || 0
  const silverMg =
    filled.reduce((s, r) => s + (Number(r.silver) || 0), 0) +
    (Number(sheet.cg?.silverCg1) || 0) +
    (Number(sheet.cg?.silverCg2) || 0)
  const copperMg =
    filled.reduce((s, r) => s + (Number(r.copper) || 0), 0) +
    (Number(sheet.cg?.copperCg1) || 0) +
    (Number(sheet.cg?.copperCg2) || 0)
  const leadG =
    filled.reduce((s, r) => s + (Number(r.lead) || 0), 0) +
    (Number(sheet.cg?.leadCg1) || 0) +
    (Number(sheet.cg?.leadCg2) || 0)
  const cornetMg = (Number(sheet.cg?.wotgcaa1) || 0) + (Number(sheet.cg?.wotgcaa2) || 0)
  const cgCupels = (cg1 > 0 ? 1 : 0) + (cg2 > 0 ? 1 : 0)
  const cupelCount = filled.length + cgCupels
  return {
    goldG: qty((cg1 + cg2) / 1000),
    goldCornetG: qty(cornetMg / 1000),
    silverG: qty(silverMg / 1000),
    copperG: qty(copperMg / 1000),
    copperMg: qty(copperMg, 3),
    leadG: qty(leadG, 3),
    leadKg: qty(leadG / 1000),
    acidLtr: qty(cupelCount * ACID_LTR_PER_CUPEL),
    cupelCount,
  }
}

type BisCornetEntry = {
  id: string
  date: string
  wotgca1: number
  wotgca2: number
  return1: number
  return2: number
}

function upsertBisFsCornet(sheet: ManakFireAssaySheet, usage: FireAssaySheetUsage, sheetKey: string) {
  const id = consumptionId('bis-gold-cornet', sheetKey)
  const date = fireAssaySheetDate(sheet) || new Date().toISOString().slice(0, 10)
  const w1 = qty((Number(sheet.cg?.wotgcaa1) || 0) / 1000)
  const w2 = qty((Number(sheet.cg?.wotgcaa2) || 0) / 1000)
  const next = loadGoldList<BisCornetEntry>(BIS_GOLD_CORNET_KEY).filter((r) => r.id !== id)
  if (usage.goldG > 0 || w1 > 0 || w2 > 0) {
    next.unshift({
      id,
      date,
      wotgca1: w1,
      wotgca2: w2,
      return1: w1,
      return2: w2,
    })
  }
  saveGoldList(BIS_GOLD_CORNET_KEY, next)
}

/**
 * Post / replace fire-assay consumption. Idempotent for the same
 * sheet identity (date|purity|shift|sheetNo).
 */
export function applyFireAssayStockConsumption(sheet: ManakFireAssaySheet): FireAssaySheetUsage {
  const usage = fireAssaySheetUsage(sheet)
  const sheetKey = fireAssayConsumptionSheetKey(sheet)
  const date = fireAssaySheetDate(sheet) || new Date().toISOString().slice(0, 10)
  const filled = (sheet.rows || []).filter((r) => String(r.jobCardNo || '').trim())
  const maxLead = Math.max(
    0,
    ...filled.map((r) => Number(r.lead) || 0),
    Number(sheet.cg?.leadCg1) || 0,
    Number(sheet.cg?.leadCg2) || 0,
  )
  const bisDiameter = cupelDiameterMmForLeadG(maxLead)

  const chainPosts: { kind: StockKind; qty: number; size?: string }[] = [
    { kind: 'silver', qty: usage.silverG },
    { kind: 'bis-silver', qty: usage.silverG },
    { kind: 'copper', qty: usage.copperMg },
    { kind: 'bis-copper', qty: usage.copperMg },
    { kind: 'lead', qty: usage.leadG },
    { kind: 'bis-lead', qty: usage.leadG },
    { kind: 'acid', qty: usage.acidLtr },
    { kind: 'bis-acid', qty: usage.acidLtr },
    { kind: 'cuppels', qty: usage.cupelCount, size: '6' },
    { kind: 'bis-cupels', qty: usage.cupelCount, size: bisDiameter },
  ]
  for (const post of chainPosts) {
    upsertChainUsage(post.kind, consumptionId(`qm-${post.kind}`, sheetKey), date, post.qty, post.size)
    const labBook = post.kind === 'silver' || post.kind === 'bis-silver' ? 'process' : 'used'
    upsertLabBook(post.kind, labBook, consumptionId(`lab-${post.kind}`, sheetKey), date, post.qty, post.size)
  }

  upsertGoldLabEntry(LAB_GOLD_CG_KEY, {
    id: consumptionId('lab-gold-cg', sheetKey),
    date,
    weight: usage.goldG,
    cornetWeight: usage.goldCornetG,
  })
  upsertGoldLabEntry(LAB_BIS_GOLD_CG_KEY, {
    id: consumptionId('lab-bis-gold-cg', sheetKey),
    date,
    weight: usage.goldG,
    cornetWeight: usage.goldCornetG,
  })
  upsertGoldLabEntry(GOLD_LAB_KEY, {
    id: consumptionId('qm-gold-lab', sheetKey),
    date,
    weight: usage.goldG,
    cornetWeight: usage.goldG || usage.goldCornetG,
  })
  upsertBisFsCornet(sheet, usage, sheetKey)

  return usage
}
