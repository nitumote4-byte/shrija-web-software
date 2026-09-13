import type { OtherServiceWeightUnit } from '../../../data/otherServices'
import { WEIGHT_PRODUCT_CUSTOM, WEIGHT_PRODUCT_PRESETS } from '../../../data/otherServices'

export type DraftItem = {
  key: string
  description: string
  quantity: string
  rate: string
}

export type DraftWeightItem = {
  key: string
  /** Preset product name, custom free-text, or empty. */
  productPreset: string
  /** Used when productPreset is Other / Custom Item (or a free-typed name). */
  customName: string
  quantity: string
  unit: OtherServiceWeightUnit
  rate: string
}

let draftSeq = 1

export function newDraftItem(seed?: Partial<DraftItem>): DraftItem {
  draftSeq += 1
  return {
    key: seed?.key || `osi-${Date.now()}-${draftSeq}`,
    description: seed?.description || '',
    quantity: seed?.quantity || '',
    rate: seed?.rate || '',
  }
}

export function newDraftWeightItem(seed?: Partial<DraftWeightItem>): DraftWeightItem {
  draftSeq += 1
  return {
    key: seed?.key || `osw-${Date.now()}-${draftSeq}`,
    productPreset: seed?.productPreset || '',
    customName: seed?.customName || '',
    quantity: seed?.quantity || '',
    unit: seed?.unit || 'GM',
    rate: seed?.rate || '',
  }
}

export function weightItemProductName(row: DraftWeightItem): string {
  if (row.productPreset === WEIGHT_PRODUCT_CUSTOM) return row.customName.trim()
  if (row.productPreset) return row.productPreset.trim()
  return row.customName.trim()
}

export function draftWeightFromSaved(input: {
  id?: string
  description: string
  quantity: number
  unit?: OtherServiceWeightUnit
  rate: number
}): DraftWeightItem {
  const name = String(input.description || '').trim()
  const isPreset = (WEIGHT_PRODUCT_PRESETS as readonly string[]).includes(name)
  return newDraftWeightItem({
    key: input.id,
    productPreset: isPreset ? name : name ? WEIGHT_PRODUCT_CUSTOM : '',
    customName: isPreset ? '' : name,
    quantity: String(input.quantity),
    unit: input.unit || 'GM',
    rate: String(input.rate),
  })
}
