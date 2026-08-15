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

/**
 * Deterministic comparison key — ignores punctuation and a trailing plural "s"
 * on words longer than three letters. Applied to both sides, so it can only
 * match spelling/plural variants of the same words (never a different item).
 */
function categoryKey(name: string): string {
  return normalizeItemCategoryName(name)
    .replace(/[.'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word))
    .join(' ')
}

/** Known equivalent spellings of the same jewellery article (not aliases for other items). */
const ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['pendent', 'pendant'],
  ['mix ornaments', 'mixed ornaments', 'assorted ornaments'],
]

const ALIAS_BY_KEY: ReadonlyMap<string, readonly string[]> = new Map(
  ALIAS_GROUPS.flatMap((group) => {
    const keys = group.map(categoryKey)
    return keys.map((key) => [key, keys] as const)
  }),
)

export function matchItemMasterName(
  voucherItem: string,
  itemMasterNames: readonly string[],
): string | null {
  const needle = normalizeItemCategoryName(voucherItem)
  if (!needle || itemMasterNames.length === 0) return null

  const exact = itemMasterNames.find((name) => normalizeItemCategoryName(name) === needle)
  if (exact) return exact

  const needleKey = categoryKey(voucherItem)
  const sameKey = itemMasterNames.find((name) => categoryKey(name) === needleKey)
  if (sameKey) return sameKey

  const aliasKeys = ALIAS_BY_KEY.get(needleKey)
  if (!aliasKeys) return null

  const aliasHit = itemMasterNames.find((name) => aliasKeys.includes(categoryKey(name)))
  return aliasHit ?? null
}

export function unmatchedItemCategoryMessage(voucherItem: string): string {
  const label = voucherItem.trim()
  if (!label) {
    return 'Voucher Item Category was missing. Please select the correct item manually.'
  }
  return `Voucher item '${label}' could not be matched with an Item Master item. Please select the correct item manually.`
}
