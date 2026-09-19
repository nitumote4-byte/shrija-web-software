import { normalizePartyName } from './voucherPartyMatch'

/** Minimal party shape needed for id / name lookup. */
export type PartyRef = {
  id: string
  name: string
}

/**
 * Resolve a party after delete/recreate: prefer id, then exact normalized name.
 * Orphaned requests keep the old partyId but still carry partyName.
 */
export function resolveParty<T extends PartyRef>(
  parties: T[] | undefined | null,
  opts: { partyId?: string | null; partyName?: string | null },
): T | undefined {
  const list = parties ?? []
  const id = String(opts.partyId ?? '').trim()
  if (id) {
    const byId = list.find((p) => p.id === id)
    if (byId) return byId
  }
  const nameKey = normalizePartyName(opts.partyName ?? '')
  if (!nameKey) return undefined
  return list.find((p) => normalizePartyName(p.name) === nameKey)
}

/** True when partyId is set but no longer present in the party list. */
export function isOrphanPartyId(
  parties: PartyRef[] | undefined | null,
  partyId: string | null | undefined,
): boolean {
  const id = String(partyId ?? '').trim()
  if (!id) return false
  return !(parties ?? []).some((p) => p.id === id)
}
