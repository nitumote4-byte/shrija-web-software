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

export function itemMasterCreateFailedMessage(voucherItem: string): string {
  const label = voucherItem.trim()
  return `Could not create Item Master item '${label}'. Please try again.`
}

export type EnsureItemMasterOk = {
  ok: true
  name: string
  created: boolean
}

export type EnsureItemMasterErr = {
  ok: false
  error: string
}

export type EnsureItemMasterResult = EnsureItemMasterOk | EnsureItemMasterErr

/**
 * Match a voucher item against Item Master. If no equivalent exists, create one
 * via the provided create function (the existing Item Master save API).
 *
 * Matching is unchanged: exact / normalized / alias rules in matchItemMasterName.
 */
export function ensureVoucherItemMasterName(
  voucherItem: string,
  getItemMasterNames: () => readonly string[],
  createItem: (name: string) => { name: string } | null | undefined,
): EnsureItemMasterResult {
  const trimmed = voucherItem.trim()
  if (!trimmed) {
    return { ok: false, error: unmatchedItemCategoryMessage(voucherItem) }
  }

  const matched = matchItemMasterName(trimmed, getItemMasterNames())
  if (matched) {
    return { ok: true, name: matched, created: false }
  }

  let created: { name: string } | null | undefined
  try {
    created = createItem(trimmed)
  } catch {
    return { ok: false, error: itemMasterCreateFailedMessage(trimmed) }
  }

  if (created?.name) {
    return { ok: true, name: created.name, created: true }
  }

  const rematch = matchItemMasterName(trimmed, getItemMasterNames())
  if (rematch) {
    return { ok: true, name: rematch, created: false }
  }

  return { ok: false, error: itemMasterCreateFailedMessage(trimmed) }
}

export type VoucherItemFields = {
  item: string
  pic: string
  weight: string
  purity: string
  requestNo: string
  receiptNo: string
  jobCardNo?: string
}

export type ResolvedVoucherItemRow = {
  item: string
  pic: string
  weight: string
  purity: string
  requestNo: string
  receiptNo: string
  jobCardNo: string
  itemMatchWarning?: string
  createdItemMaster: boolean
}

/** Resolve one voucher line: match or auto-create Item Master; preserve voucher fields. */
export function resolveVoucherItemRow(
  line: VoucherItemFields,
  getItemMasterNames: () => readonly string[],
  createItem: (name: string) => { name: string } | null | undefined,
): ResolvedVoucherItemRow {
  const voucherItem = line.item.trim()
  const resolved = ensureVoucherItemMasterName(voucherItem, getItemMasterNames, createItem)
  return {
    item: resolved.ok ? resolved.name : voucherItem,
    pic: line.pic,
    weight: line.weight,
    purity: line.purity,
    requestNo: line.requestNo,
    receiptNo: line.receiptNo,
    jobCardNo: line.jobCardNo || '',
    itemMatchWarning: resolved.ok ? undefined : resolved.error,
    createdItemMaster: resolved.ok ? resolved.created : false,
  }
}
