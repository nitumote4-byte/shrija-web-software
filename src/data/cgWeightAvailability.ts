/**
 * CG mass validity — same numeric rule QM Stock uses when adding a CG weight.
 * Missing / 0 / NaN must not be treated as a usable Fire Assay CG mass.
 */

export function isValidCgWeightValue(weight: unknown): boolean {
  if (weight == null || weight === '') return false
  const n = typeof weight === 'number' ? weight : Number(weight)
  return Number.isFinite(n) && n > 0
}

/** Fire Assay may use CG1, CG2, or both. Either valid selected mass is enough. */
export function hasAvailableCgWeightForSheet(cg1Weight: unknown, cg2Weight: unknown): boolean {
  return isValidCgWeightValue(cg1Weight) || isValidCgWeightValue(cg2Weight)
}
