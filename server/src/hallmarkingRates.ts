/**
 * BIS Hallmarking Amendment Regulations, 2026 — Schedule IV
 * (notification dated 14 September 2026)
 *
 * Customer / jeweller-facing AHC hallmarking charges vs BIS levy on the AHC
 * are intentionally separate. Taxes remain additional as applicable.
 */

export type HallmarkMetal = 'Gold' | 'Silver' | 'Platinum'

/** Hallmarking fee payable by jeweller to recognised AHC — per article */
export const GOLD_HALLMARKING_FEE_PER_ARTICLE = 75
export const SILVER_HALLMARKING_FEE_PER_ARTICLE = 35

/** Minimum consignment fee — jeweller to AHC */
export const GOLD_MIN_CONSIGNMENT_FEE = 200
export const SILVER_MIN_CONSIGNMENT_FEE = 150

/** BIS fee levied from AHC — per article */
export const GOLD_BIS_FEE_PER_ARTICLE = 7.5
export const SILVER_BIS_FEE_PER_ARTICLE = 3.5

/** BIS minimum consignment levy */
export const GOLD_BIS_MIN_CONSIGNMENT_FEE = 20
export const SILVER_BIS_MIN_CONSIGNMENT_FEE = 15

export function normalizeHallmarkMetal(
  metal: string | null | undefined,
): HallmarkMetal | null {
  const m = String(metal || '')
    .trim()
    .toLowerCase()
  if (m === 'gold') return 'Gold'
  if (m === 'silver') return 'Silver'
  if (m === 'platinum') return 'Platinum'
  return null
}

/** Infer metal from purity codes (925 / silver → Silver; otherwise Gold). */
export function metalFromPurity(purity: string | null | undefined): HallmarkMetal {
  const s = String(purity || '')
    .trim()
    .toLowerCase()
  if (!s) return 'Gold'
  if (s.includes('silver') || /\b925\b/.test(s) || s === '925') return 'Silver'
  return 'Gold'
}

/** Customer-facing AHC hallmarking rate per article for the metal. */
export function hallmarkingFeePerArticle(
  metal: string | null | undefined,
): number {
  const m = normalizeHallmarkMetal(metal) ?? 'Gold'
  if (m === 'Silver') return SILVER_HALLMARKING_FEE_PER_ARTICLE
  return GOLD_HALLMARKING_FEE_PER_ARTICLE
}

/**
 * Minimum jeweller→AHC consignment fee.
 * Silver uses the notified ₹150 floor. Gold (and unknown) uses Invoice Settings
 * amount when provided, else the notified Gold floor ₹200.
 */
export function resolveHallmarkMinConsignmentFee(
  metal: string | null | undefined,
  settingsMinAmount?: number,
): number {
  const m = normalizeHallmarkMetal(metal) ?? metalFromPurity(null)
  if (m === 'Silver') return SILVER_MIN_CONSIGNMENT_FEE
  const n = Number(settingsMinAmount)
  if (Number.isFinite(n) && n >= 0) return Number(n.toFixed(2))
  return GOLD_MIN_CONSIGNMENT_FEE
}

export function bisFeePerArticle(metal: string | null | undefined): number {
  const m = normalizeHallmarkMetal(metal) ?? 'Gold'
  if (m === 'Silver') return SILVER_BIS_FEE_PER_ARTICLE
  return GOLD_BIS_FEE_PER_ARTICLE
}

export function bisMinConsignmentFee(metal: string | null | undefined): number {
  const m = normalizeHallmarkMetal(metal) ?? 'Gold'
  if (m === 'Silver') return SILVER_BIS_MIN_CONSIGNMENT_FEE
  return GOLD_BIS_MIN_CONSIGNMENT_FEE
}

/** BIS levy for one consignment: max(articles × rate, metal minimum). */
export function bisLevyForConsignment(
  articles: number,
  metal: string | null | undefined,
): number {
  const hm = Math.max(0, Number(articles) || 0)
  const raw = Number((hm * bisFeePerArticle(metal)).toFixed(2))
  const min = bisMinConsignmentFee(metal)
  return Number(Math.max(raw, hm > 0 ? min : 0).toFixed(2))
}

/** Apply notified Schedule IV rate onto a category row by its metal. */
export function applyNotifiedHallmarkingRate<T extends { metal: string; rate: number }>(
  category: T,
): T {
  return {
    ...category,
    rate: hallmarkingFeePerArticle(category.metal),
  }
}
