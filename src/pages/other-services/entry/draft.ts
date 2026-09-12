export type DraftItem = {
  key: string
  description: string
  quantity: string
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
