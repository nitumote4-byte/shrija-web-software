/**
 * Job Card / lot identity for Fire Assay sheets.
 * Format: `{lot}_{jobCard}` e.g. 1_123 → lot 1, job 123.
 * Uniqueness is (jobCard + lotNo), not jobCard alone.
 */

export function parseLotJobCard(raw: string): { lotNo: number; jobCard: string } {
  const t = raw.trim()
  const m = /^(\d+)\s*[_\-/]\s*(\d+)$/.exec(t)
  if (m) return { lotNo: Number(m[1]), jobCard: m[2] }
  // Plain Manak job card number only
  if (/^\d{6,}$/.test(t)) return { lotNo: 0, jobCard: t }
  return { lotNo: 1, jobCard: t }
}

/** uniqueKey = `${jobCardNo}_${lotNo}` — e.g. 1_123 → "123_1". */
export function lotQualifiedJobKey(raw: string): string {
  const parsed = parseLotJobCard(raw)
  const card = (parsed.jobCard || raw).trim()
  if (!card) return ''
  return `${card}_${parsed.lotNo}`
}

/**
 * Base job identity for Model C assay F* seeding.
 * 1_123 / 2_123 / 3_123 → 123. Empty / non-numeric → 0 (unassigned blank).
 */
export function baseJobCardNumberFromRaw(raw: string): number {
  const card = (parseLotJobCard(raw).jobCard || raw).trim()
  if (!card) return 0
  const n = Number(card)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.trunc(n)
}

type RowLike = { key: string; jobCardNo: string }

/** Partner strip in the 2-row lot pair layout (indices 0–1, 2–3, …). */
export function sheetPairPartnerKey(list: RowLike[], rowKey: string): string | null {
  const idx = list.findIndex((r) => r.key === rowKey)
  if (idx < 0) return null
  const partner = idx % 2 === 0 ? list[idx + 1] : list[idx - 1]
  return partner?.key ?? null
}

/**
 * Same lot-qualified id on another lot pair = duplicate.
 * The paired strip (same 2-row lot) may share the exact job card value.
 */
export function findDuplicateLotQualifiedJob<T extends RowLike>(
  value: string,
  rowKey: string,
  list: T[],
): T | null {
  const key = lotQualifiedJobKey(value)
  if (!key) return null
  const partnerKey = sheetPairPartnerKey(list, rowKey)
  for (const r of list) {
    if (!r.jobCardNo.trim()) continue
    if (r.key === rowKey) continue
    if (partnerKey && r.key === partnerKey) continue
    if (lotQualifiedJobKey(r.jobCardNo) === key) return r
  }
  return null
}
