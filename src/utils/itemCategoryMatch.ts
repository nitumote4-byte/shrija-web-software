/**
 * Map an AHC voucher Item Category onto Item Master names.
 *
 * Matching is case-insensitive and trims whitespace. It is NOT fuzzy /
 * substring matching — "Lock" must not become "Locket".
 *
 * pendent ↔ pendant is a closed spelling variant (BIS AHC vs English),
 * applied only after exact match fails, and never maps onto unrelated
 * items such as Locket.
 */

export function normalizeItemCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Known equivalent spellings of the same jewellery article (not aliases for other items). */
const SPELLING_VARIANTS: ReadonlyMap<string, readonly string[]> = new Map([
  ['pendent', ['pendent', 'pendant']],
  ['pendant', ['pendent', 'pendant']],
])

export function matchItemMasterName(
  voucherItem: string,
  itemMasterNames: readonly string[],
): string | null {
  const needle = normalizeItemCategoryName(voucherItem)
  if (!needle || itemMasterNames.length === 0) return null

  const exact = itemMasterNames.find((name) => normalizeItemCategoryName(name) === needle)
  if (exact) return exact

  const variants = SPELLING_VARIANTS.get(needle)
  if (!variants) return null

  const variantHit = itemMasterNames.find((name) =>
    variants.includes(normalizeItemCategoryName(name)),
  )
  return variantHit ?? null
}

export function unmatchedItemCategoryMessage(voucherItem: string): string {
  const label = voucherItem.trim()
  if (!label) {
    return 'Voucher Item Category was missing. Please select the correct item manually.'
  }
  return `Voucher item '${label}' could not be matched with an Item Master item. Please select the correct item manually.`
}
