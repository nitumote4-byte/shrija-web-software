/**
 * Explicit invoice deletion records for the shared Main/OSC tenant store.
 * Array absence is not enough: 409 unions and Main writes would otherwise
 * resurrect Off-Site invoices. Tombstones live in the same store JSON.
 *
 * Cleanup: tombstones older than INVOICE_TOMBSTONE_TTL_MS are dropped during
 * merge. Stale clients older than that window could theoretically resurrect;
 * that is accepted to bound unbounded growth.
 */

export const INVOICE_TOMBSTONES_KEY = 'deletedInvoices' as const

export const INVOICE_TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export type InvoiceTombstone = {
  id: string
  centreId: string
  centreKind: 'main' | 'osc'
  deletedAt: string
  requestNo?: string
}

export type CentreActor = {
  centreId: string
  centreKind: 'main' | 'osc'
}

type CentreMeta = {
  centreId?: string
  centreKind?: string
}

function rowId(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const id = (item as { id?: unknown }).id
  return typeof id === 'string' && id.trim() ? id.trim() : ''
}

export function isOscCentreMeta(meta?: CentreMeta | null): boolean {
  if (!meta) return false
  if (String(meta.centreKind || '').toLowerCase() === 'osc') return true
  if (meta.centreId && meta.centreId !== 'main') return true
  return false
}

/** OSC may delete only invoices tagged with its JWT/session centreId. Main may delete only Main-owned invoices. */
export function canDeleteInvoiceForCentre(
  invoice: CentreMeta | null | undefined,
  actor: CentreActor | null | undefined,
): boolean {
  if (!invoice || !actor?.centreId) return false
  if (actor.centreKind === 'osc') {
    return String(invoice.centreId || '') === actor.centreId
  }
  return !isOscCentreMeta(invoice)
}

export function makeInvoiceTombstone(
  invoice: { id: string; requestNo?: string } & CentreMeta,
  actor: CentreActor,
  deletedAt = new Date().toISOString(),
): InvoiceTombstone {
  return {
    id: invoice.id,
    centreId: actor.centreKind === 'osc' ? actor.centreId : invoice.centreId || actor.centreId || 'main',
    centreKind: actor.centreKind === 'osc' ? 'osc' : 'main',
    deletedAt,
    requestNo: String(invoice.requestNo || '').trim() || undefined,
  }
}

export function parseInvoiceTombstones(value: unknown): InvoiceTombstone[] {
  if (!Array.isArray(value)) return []
  const out: InvoiceTombstone[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const centreId = typeof rec.centreId === 'string' ? rec.centreId.trim() : ''
    const centreKind = String(rec.centreKind || '').toLowerCase() === 'osc' ? 'osc' : 'main'
    const deletedAt = typeof rec.deletedAt === 'string' ? rec.deletedAt : ''
    const requestNo = typeof rec.requestNo === 'string' ? rec.requestNo.trim() : ''
    out.push({
      id,
      centreId,
      centreKind,
      deletedAt,
      ...(requestNo ? { requestNo } : {}),
    })
  }
  return out
}

export function tombstoneIsActive(tombstone: InvoiceTombstone, now = Date.now()): boolean {
  if (!tombstone.deletedAt) return true
  const ts = Date.parse(tombstone.deletedAt)
  if (!Number.isFinite(ts)) return true
  return now - ts < INVOICE_TOMBSTONE_TTL_MS
}

export function unionInvoiceTombstones(
  existing: unknown,
  incoming: unknown,
  now = Date.now(),
): InvoiceTombstone[] {
  const byId = new Map<string, InvoiceTombstone>()
  for (const row of [...parseInvoiceTombstones(existing), ...parseInvoiceTombstones(incoming)]) {
    if (!tombstoneIsActive(row, now)) continue
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

export function applyInvoiceTombstones<T>(invoices: T[], tombstones: unknown): T[] {
  const ids = new Set(
    parseInvoiceTombstones(tombstones)
      .filter((row) => tombstoneIsActive(row))
      .map((row) => row.id),
  )
  if (ids.size === 0) return invoices
  return invoices.filter((item) => {
    const id = rowId(item)
    return !id || !ids.has(id)
  })
}

export function tombstoneIds(tombstones: unknown): Set<string> {
  return new Set(
    parseInvoiceTombstones(tombstones)
      .filter((row) => tombstoneIsActive(row))
      .map((row) => row.id),
  )
}
